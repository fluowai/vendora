package main

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/store/sqlstore"
	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"
	waProto "go.mau.fi/whatsmeow/binary/proto"
	"google.golang.org/protobuf/proto"
	_ "modernc.org/sqlite"
)

type bridgeState struct {
	client      *whatsmeow.Client
	webhookURL  string
	secret      string
	currentQR   string
	connected   bool
	lastError    string
	mu          sync.RWMutex
}

type sendRequest struct {
	To             string `json:"to"`
	Text           string `json:"text"`
	ConversationID string `json:"conversationId"`
}

type configRequest struct {
	WebhookURL string `json:"webhookUrl"`
}

func main() {
	state := &bridgeState{
		webhookURL: os.Getenv("WHATSMEOW_WEBHOOK_URL"),
		secret:     os.Getenv("WHATSMEOW_BRIDGE_SECRET"),
	}

	dbPath := env("WHATSMEOW_DB_PATH", "file:whatsmeow.db?_pragma=foreign_keys(1)")
	container, err := sqlstore.New(context.Background(), "sqlite", dbPath, nil)
	if err != nil {
		log.Fatalf("store init failed: %v", err)
	}

	device, err := container.GetFirstDevice(context.Background())
	if err != nil {
		log.Fatalf("device init failed: %v", err)
	}

	state.client = whatsmeow.NewClient(device, nil)
	state.client.AddEventHandler(state.handleEvent)

	go state.connect()

	mux := http.NewServeMux()
	mux.HandleFunc("/status", state.handleStatus)
	mux.HandleFunc("/qr", state.handleQR)
	mux.HandleFunc("/send", state.handleSend)
	mux.HandleFunc("/config", state.handleConfig)
	mux.HandleFunc("/logout", state.handleLogout)

	addr := ":" + env("PORT", "4000")
	log.Printf("[whatsmeow-bridge] listening on %s", addr)
	log.Fatal(http.ListenAndServe(addr, withCORS(mux)))
}

func (s *bridgeState) connect() {
	if s.client.Store.ID == nil {
		qrChan, err := s.client.GetQRChannel(context.Background())
		if err != nil {
			s.setError(err)
			return
		}

		if err := s.client.Connect(); err != nil {
			s.setError(err)
			return
		}

		for evt := range qrChan {
			if evt.Event == "code" {
				s.mu.Lock()
				s.currentQR = evt.Code
				s.connected = false
				s.mu.Unlock()
				log.Println("[whatsmeow-bridge] QR code updated")
			} else {
				log.Printf("[whatsmeow-bridge] login event: %s", evt.Event)
			}
		}
		return
	}

	if err := s.client.Connect(); err != nil {
		s.setError(err)
	}
}

func (s *bridgeState) handleEvent(evt any) {
	switch v := evt.(type) {
	case *events.Connected:
		s.mu.Lock()
		s.connected = true
		s.currentQR = ""
		s.lastError = ""
		s.mu.Unlock()
	case *events.Disconnected:
		s.mu.Lock()
		s.connected = false
		s.mu.Unlock()
	case *events.Message:
		text := v.Message.GetConversation()
		if text == "" && v.Message.GetExtendedTextMessage() != nil {
			text = v.Message.GetExtendedTextMessage().GetText()
		}
		if text == "" {
			return
		}

		payload := map[string]any{
			"id":        v.Info.ID,
			"messageId": v.Info.ID,
			"from":      v.Info.Sender.String(),
			"remoteJid": v.Info.Chat.String(),
			"chatId":    v.Info.Chat.String(),
			"pushName":  v.Info.PushName,
			"text":      text,
			"timestamp": v.Info.Timestamp,
		}
		s.postWebhook(payload)
	}
}

func (s *bridgeState) handleStatus(w http.ResponseWriter, _ *http.Request) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	writeJSON(w, http.StatusOK, map[string]any{
		"connected": s.connected,
		"hasQR":     s.currentQR != "",
		"lastError": s.lastError,
	})
}

func (s *bridgeState) handleQR(w http.ResponseWriter, _ *http.Request) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	writeJSON(w, http.StatusOK, map[string]any{
		"connected": s.connected,
		"qr":        s.currentQR,
	})
}

func (s *bridgeState) handleSend(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	if !s.authorized(r) {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	var input sendRequest
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json"})
		return
	}
	if input.To == "" || input.Text == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "to and text are required"})
		return
	}

	jid, err := types.ParseJID(normalizeJID(input.To))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	resp, err := s.client.SendMessage(context.Background(), jid, &waProto.Message{
		Conversation: proto.String(input.Text),
	})
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusAccepted, map[string]any{
		"sent":      true,
		"messageId": resp.ID,
		"timestamp": resp.Timestamp,
	})
}

func (s *bridgeState) handleConfig(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	if !s.authorized(r) {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	var input configRequest
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json"})
		return
	}
	if input.WebhookURL == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "webhookUrl is required"})
		return
	}

	s.mu.Lock()
	s.webhookURL = input.WebhookURL
	s.mu.Unlock()

	writeJSON(w, http.StatusOK, map[string]any{
		"configured": true,
		"webhookUrl": input.WebhookURL,
	})
}

func (s *bridgeState) handleLogout(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	if !s.authorized(r) {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}
	if err := s.client.Logout(context.Background()); err != nil && err != sql.ErrNoRows {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"loggedOut": true})
}

func (s *bridgeState) postWebhook(payload any) {
	if s.webhookURL == "" {
		log.Println("[whatsmeow-bridge] WHATSMEOW_WEBHOOK_URL not configured; dropping inbound message")
		return
	}

	body, _ := json.Marshal(payload)
	req, err := http.NewRequest(http.MethodPost, s.webhookURL, bytes.NewReader(body))
	if err != nil {
		s.setError(err)
		return
	}
	req.Header.Set("Content-Type", "application/json")
	if s.secret != "" {
		req.Header.Set("Authorization", "Bearer "+s.secret)
	}

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		s.setError(err)
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		s.setError(fmt.Errorf("webhook returned %s", resp.Status))
	}
}

func (s *bridgeState) authorized(r *http.Request) bool {
	if s.secret == "" {
		return true
	}
	return strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ") == s.secret
}

func (s *bridgeState) setError(err error) {
	log.Printf("[whatsmeow-bridge] error: %v", err)
	s.mu.Lock()
	s.lastError = err.Error()
	s.mu.Unlock()
}

func normalizeJID(value string) string {
	value = strings.TrimSpace(value)
	if strings.Contains(value, "@") {
		return value
	}
	value = strings.TrimPrefix(value, "+")
	return value + "@s.whatsapp.net"
}

func env(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func writeJSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}

func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}
