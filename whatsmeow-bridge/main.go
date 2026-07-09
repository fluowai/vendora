package main

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"sync"
	"sync/atomic"
	"syscall"
	"time"

	"go.mau.fi/whatsmeow"
	waProto "go.mau.fi/whatsmeow/binary/proto"
	"go.mau.fi/whatsmeow/store/sqlstore"
	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"

	"google.golang.org/protobuf/proto"
	_ "modernc.org/sqlite"
)

var (
	startupTime  = time.Now()
	buildVersion = "dev"
)

type bridgeMetrics struct {
	messagesReceived atomic.Int64
	messagesSent     atomic.Int64
	reconnectCount   atomic.Int64
	webhookFailures  atomic.Int64
	webhookRetries   atomic.Int64
}

type bridgeState struct {
	client         *whatsmeow.Client
	webhookURL     string
	secret         string
	currentQR      string
	currentQRUntil time.Time
	pairingCode    string
	pairingPhone   string
	pairingExpires time.Time
	pairingEvent   string
	passkeyPending bool
	connected      bool
	lastError      string
	mu             sync.RWMutex

	reconnectAttempt int
	stopReconnect    chan struct{}
	connectedCh      chan struct{}
	pairReadyCh      chan struct{}
	pairReadyOnce    sync.Once
	metrics          bridgeMetrics

	webhookQueue chan webhookJob
}

type sendRequest struct {
	To             string `json:"to"`
	Text           string `json:"text"`
	ConversationID string `json:"conversationId"`
}

type sendMediaRequest struct {
	To             string `json:"to"`
	Caption        string `json:"caption"`
	MediaURL       string `json:"mediaUrl"`
	MediaType      string `json:"mediaType"`
	FileName       string `json:"fileName"`
	ConversationID string `json:"conversationId"`
}

type sendButtonsRequest struct {
	To             string          `json:"to"`
	Text           string          `json:"text"`
	Footer         string          `json:"footer"`
	Buttons        []buttonContent `json:"buttons"`
	ConversationID string          `json:"conversationId"`
}

type buttonContent struct {
	ID    string `json:"id"`
	Title string `json:"title"`
}

type sendListRequest struct {
	To             string        `json:"to"`
	Title          string        `json:"title"`
	Description    string        `json:"description"`
	ButtonText     string        `json:"buttonText"`
	Sections       []listSection `json:"sections"`
	ConversationID string        `json:"conversationId"`
}

type listSection struct {
	Title string    `json:"title"`
	Rows  []listRow `json:"rows"`
}

type listRow struct {
	ID          string `json:"id"`
	Title       string `json:"title"`
	Description string `json:"description"`
}

type sendReplyRequest struct {
	To             string `json:"to"`
	Text           string `json:"text"`
	ReplyToID      string `json:"replyToId"`
	ConversationID string `json:"conversationId"`
}

type sendReactionRequest struct {
	To             string `json:"to"`
	MessageID      string `json:"messageId"`
	Emoji          string `json:"emoji"`
	ConversationID string `json:"conversationId"`
}

type sendPollRequest struct {
	To             string   `json:"to"`
	Question       string   `json:"question"`
	Options        []string `json:"options"`
	MaxAnswers     int      `json:"maxAnswers"`
	ConversationID string   `json:"conversationId"`
}

type sendLocationRequest struct {
	To             string  `json:"to"`
	Latitude       float64 `json:"latitude"`
	Longitude      float64 `json:"longitude"`
	Name           string  `json:"name"`
	Address        string  `json:"address"`
	ConversationID string  `json:"conversationId"`
}

type sendContactRequest struct {
	To             string `json:"to"`
	ContactName    string `json:"contactName"`
	Phone          string `json:"phone"`
	ConversationID string `json:"conversationId"`
}

type sendStickerRequest struct {
	To             string `json:"to"`
	MediaURL       string `json:"mediaUrl"`
	ConversationID string `json:"conversationId"`
}

type sendDeleteRequest struct {
	To             string `json:"to"`
	MessageID      string `json:"messageId"`
	ConversationID string `json:"conversationId"`
}

type typingRequest struct {
	To    string `json:"to"`
	State string `json:"state"`
}

type configRequest struct {
	WebhookURL string `json:"webhookUrl"`
}

type pairCodeRequest struct {
	Phone                string `json:"phone"`
	ShowPushNotification bool   `json:"showPushNotification"`
	ClientType           string `json:"clientType"`
	ClientDisplayName    string `json:"clientDisplayName"`
}

type webhookJob struct {
	Payload  any
	Attempts int
	LastErr  error
}

type healthResponse struct {
	Connected        bool   `json:"connected"`
	HasQR            bool   `json:"hasQR"`
	PairingEvent     string `json:"pairingEvent,omitempty"`
	HasPairingCode   bool   `json:"hasPairingCode"`
	PasskeyPending   bool   `json:"passkeyPending"`
	JID              string `json:"jid,omitempty"`
	Phone            string `json:"phone,omitempty"`
	PushName         string `json:"pushName,omitempty"`
	BusinessName     string `json:"businessName,omitempty"`
	AvatarURL        string `json:"avatarUrl,omitempty"`
	LastError        string `json:"lastError,omitempty"`
	UptimeSeconds    int64  `json:"uptimeSeconds"`
	Version          string `json:"version"`
	MessagesReceived int64  `json:"messagesReceived"`
	MessagesSent     int64  `json:"messagesSent"`
	ReconnectCount   int64  `json:"reconnectCount"`
	WebhookRetries   int64  `json:"webhookRetries"`
	WebhookFailures  int64  `json:"webhookFailures"`
	WebhookQueueLen  int    `json:"webhookQueueLen"`
	WebhookURL       string `json:"webhookUrl,omitempty"`
}

func main() {
	log.SetFlags(log.LstdFlags | log.Lshortfile)
	log.Printf("[whatsmeow-bridge] starting version %s", buildVersion)

	state := &bridgeState{
		webhookURL:    os.Getenv("WHATSMEOW_WEBHOOK_URL"),
		secret:        os.Getenv("WHATSMEOW_BRIDGE_SECRET"),
		stopReconnect: make(chan struct{}),
		connectedCh:   make(chan struct{}, 1),
		pairReadyCh:   make(chan struct{}),
		webhookQueue:  make(chan webhookJob, 1024),
	}

	go state.processWebhookQueue()

	dbPath := env("WHATSMEOW_DB_PATH", "file:whatsmeow.db?_pragma=foreign_keys(1)")
	container, err := sqlstore.New(context.Background(), "sqlite", dbPath, nil)
	if err != nil {
		log.Fatalf("[whatsmeow-bridge] store init failed: %v", err)
	}

	device, err := container.GetFirstDevice(context.Background())
	if err != nil {
		log.Fatalf("[whatsmeow-bridge] device init failed: %v", err)
	}

	state.client = whatsmeow.NewClient(device, nil)
	state.client.AddEventHandler(state.handleEvent)

	go state.connectWithRetry()

	mux := http.NewServeMux()
	mux.HandleFunc("/status", state.handleStatus)
	mux.HandleFunc("/qr", state.handleQR)
	mux.HandleFunc("/pair/code", state.handlePairCode)
	mux.HandleFunc("/send", state.handleSend)
	mux.HandleFunc("/send/media", state.handleSendMedia)
	mux.HandleFunc("/send/buttons", state.handleSendButtons)
	mux.HandleFunc("/send/list", state.handleSendList)
	mux.HandleFunc("/send/reply", state.handleSendReply)
	mux.HandleFunc("/send/reaction", state.handleSendReaction)
	mux.HandleFunc("/send/poll", state.handleSendPoll)
	mux.HandleFunc("/send/location", state.handleSendLocation)
	mux.HandleFunc("/send/contact", state.handleSendContact)
	mux.HandleFunc("/send/sticker", state.handleSendSticker)
	mux.HandleFunc("/send/delete", state.handleSendDelete)
	mux.HandleFunc("/send/presence", state.handlePresence)
	mux.HandleFunc("/typing", state.handleTyping)
	mux.HandleFunc("/config", state.handleConfig)
	mux.HandleFunc("/logout", state.handleLogout)
	mux.HandleFunc("/health", state.handleHealth)

	addr := ":" + env("PORT", "4000")
	server := &http.Server{
		Addr:         addr,
		Handler:      withCORS(mux),
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 60 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		log.Printf("[whatsmeow-bridge] listening on %s", addr)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("[whatsmeow-bridge] server error: %v", err)
		}
	}()

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	sig := <-sigCh
	log.Printf("[whatsmeow-bridge] received signal %v, shutting down...", sig)

	close(state.stopReconnect)

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if state.client != nil {
		state.client.Disconnect()
	}

	if err := server.Shutdown(shutdownCtx); err != nil {
		log.Printf("[whatsmeow-bridge] server shutdown error: %v", err)
	}

	log.Println("[whatsmeow-bridge] shutdown complete")
}

func (s *bridgeState) connectWithRetry() {
	for {
		select {
		case <-s.stopReconnect:
			return
		default:
		}

		s.mu.Lock()
		s.reconnectAttempt++
		attempt := s.reconnectAttempt
		s.mu.Unlock()

		err := s.connect()
		if err == nil {
			s.mu.Lock()
			s.reconnectAttempt = 0
			if attempt > 1 {
				s.metrics.reconnectCount.Add(1)
			}
			s.mu.Unlock()
			return
		}

		s.setError(fmt.Errorf("connect attempt %d failed: %w", attempt, err))

		backoff := time.Duration(math.Min(float64(attempt)*2, 60)) * time.Second
		log.Printf("[whatsmeow-bridge] reconnecting in %v (attempt %d)", backoff, attempt)

		select {
		case <-s.stopReconnect:
			return
		case <-time.After(backoff):
		}
	}
}

func (s *bridgeState) connect() error {
	if s.client.Store.ID == nil {
		qrChan, err := s.client.GetQRChannel(context.Background())
		if err != nil {
			return fmt.Errorf("qr channel: %w", err)
		}

		if err := s.client.Connect(); err != nil {
			return fmt.Errorf("connect: %w", err)
		}

		for evt := range qrChan {
			switch evt.Event {
			case whatsmeow.QRChannelEventCode:
				s.mu.Lock()
				s.currentQR = evt.Code
				s.currentQRUntil = time.Now().Add(evt.Timeout)
				s.pairingEvent = evt.Event
				s.connected = false
				s.lastError = ""
				s.mu.Unlock()
				s.pairReadyOnce.Do(func() { close(s.pairReadyCh) })
				log.Println("[whatsmeow-bridge] QR code updated")
			case "success":
				s.mu.Lock()
				s.pairingEvent = evt.Event
				s.pairingCode = ""
				s.pairingPhone = ""
				s.pairingExpires = time.Time{}
				s.passkeyPending = false
				s.mu.Unlock()
				log.Println("[whatsmeow-bridge] QR scan successful")
			case whatsmeow.QRChannelEventError:
				if evt.Error != nil {
					s.setError(fmt.Errorf("pairing error: %w", evt.Error))
					return fmt.Errorf("pairing error: %w", evt.Error)
				}
				s.setPairingEvent(evt.Event)
				return fmt.Errorf("pairing error")
			case whatsmeow.QRChannelEventPasskeyRequest:
				s.mu.Lock()
				s.passkeyPending = true
				s.pairingEvent = evt.Event
				s.mu.Unlock()
				log.Println("[whatsmeow-bridge] passkey requested by WhatsApp")
			case whatsmeow.QRChannelEventPasskeyResponse:
				s.mu.Lock()
				s.passkeyPending = true
				s.pairingEvent = evt.Event
				s.mu.Unlock()
				log.Println("[whatsmeow-bridge] passkey confirmation required")
			case "timeout", "err-unexpected-state", "err-client-outdated", "err-scanned-without-multidevice":
				s.setPairingEvent(evt.Event)
				return fmt.Errorf("login event: %s", evt.Event)
			default:
				s.setPairingEvent(evt.Event)
				log.Printf("[whatsmeow-bridge] login event: %s", evt.Event)
			}
		}
		return fmt.Errorf("qr channel closed before pairing completed")
	}

	return s.client.Connect()
}

func (s *bridgeState) setPairingEvent(event string) {
	s.mu.Lock()
	s.pairingEvent = event
	s.mu.Unlock()
}

func (s *bridgeState) handleEvent(evt any) {
	switch v := evt.(type) {
	case *events.Connected:
		s.mu.Lock()
		s.connected = true
		s.currentQR = ""
		s.currentQRUntil = time.Time{}
		s.pairingCode = ""
		s.pairingPhone = ""
		s.pairingExpires = time.Time{}
		s.pairingEvent = "connected"
		s.passkeyPending = false
		s.lastError = ""
		s.mu.Unlock()
		log.Println("[whatsmeow-bridge] connected to WhatsApp")

		select {
		case s.connectedCh <- struct{}{}:
		default:
		}

	case *events.Disconnected:
		s.mu.Lock()
		s.connected = false
		s.mu.Unlock()
		log.Println("[whatsmeow-bridge] disconnected from WhatsApp")
		go s.connectWithRetry()

	case *events.Message:
		s.handleIncomingMessage(v)

	case *events.Receipt:
		s.handleReceipt(v)

	case *events.LoggedOut:
		s.mu.Lock()
		s.connected = false
		s.lastError = "logged out remotely"
		s.currentQR = ""
		s.currentQRUntil = time.Time{}
		s.pairingCode = ""
		s.pairingPhone = ""
		s.pairingExpires = time.Time{}
		s.pairingEvent = "logged_out"
		s.passkeyPending = false
		s.mu.Unlock()
		log.Println("[whatsmeow-bridge] logged out remotely")

	case *events.StreamError:
		s.setError(fmt.Errorf("stream error: %v", v.Code))
		log.Printf("[whatsmeow-bridge] stream error: %+v", v)
	}
}

func (s *bridgeState) handleIncomingMessage(v *events.Message) {
	s.metrics.messagesReceived.Add(1)

	msg := v.Message
	text := msg.GetConversation()
	if text == "" && msg.GetExtendedTextMessage() != nil {
		text = msg.GetExtendedTextMessage().GetText()
	}

	if text == "" && msg.GetButtonsResponseMessage() != nil {
		text = msg.GetButtonsResponseMessage().GetSelectedButtonID()
	}
	if text == "" && msg.GetListResponseMessage() != nil {
		text = msg.GetListResponseMessage().GetSingleSelectReply().GetSelectedRowID()
	}

	mediaInfo := s.extractMediaInfo(msg)
	hasMedia := mediaInfo != nil
	chatJID := v.Info.Chat.String()
	senderJID := resolvePhoneJID(v.Info.Sender, v.Info.SenderAlt)
	isGroup := strings.HasSuffix(chatJID, "@g.us")
	chatType := "private"
	if isGroup {
		chatType = "group"
	}
	groupName := ""
	if isGroup {
		groupName = s.getGroupName(v.Info.Chat)
	}
	avatarURL := s.getProfilePictureURL(v.Info.Chat)

	payload := map[string]any{
		"id":           v.Info.ID,
		"messageId":    v.Info.ID,
		"from":         senderJID,
		"senderJid":    senderJID,
		"senderAltJid": v.Info.SenderAlt.String(),
		"remoteJid":    chatJID,
		"chatId":       chatJID,
		"groupName":    groupName,
		"avatarUrl":    avatarURL,
		"participantJid": func() string {
			if isGroup {
				return senderJID
			}
			return ""
		}(),
		"isGroup":     isGroup,
		"chatType":    chatType,
		"pushName":    v.Info.PushName,
		"text":        text,
		"timestamp":   v.Info.Timestamp,
		"hasMedia":    hasMedia,
		"messageType": s.getMessageType(msg),
	}

	if msg.GetButtonsResponseMessage() != nil {
		payload["interactiveType"] = "button"
		payload["interactivePayload"] = map[string]any{
			"id":    msg.GetButtonsResponseMessage().GetSelectedButtonID(),
			"title": msg.GetButtonsResponseMessage().GetSelectedDisplayText(),
		}
	}

	if msg.GetListResponseMessage() != nil {
		payload["interactiveType"] = "list"
		payload["interactivePayload"] = map[string]any{
			"id":    msg.GetListResponseMessage().GetSingleSelectReply().GetSelectedRowID(),
			"title": msg.GetListResponseMessage().GetSingleSelectReply().GetSelectedRowID(),
		}
	}

	if hasMedia {
		if data, err := s.client.DownloadAny(context.Background(), msg); err == nil {
			mediaInfo["dataBase64"] = base64.StdEncoding.EncodeToString(data)
			mediaInfo["size"] = len(data)
		} else {
			mediaInfo["downloadError"] = err.Error()
			log.Printf("[whatsmeow-bridge] media download failed: %v", err)
		}
		payload["media"] = mediaInfo
	}

	if text == "" && !hasMedia {
		return
	}

	s.enqueueWebhook(payload)
}

func resolvePhoneJID(primary types.JID, alt types.JID) string {
	primaryText := primary.String()
	altText := alt.String()
	if strings.HasSuffix(primaryText, "@lid") && altText != "" && !strings.HasSuffix(altText, "@lid") {
		return altText
	}
	return primaryText
}

func (s *bridgeState) getGroupName(jid types.JID) string {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	info, err := s.client.GetGroupInfo(ctx, jid)
	if err != nil || info == nil {
		return ""
	}
	return info.Name
}

func (s *bridgeState) getProfilePictureURL(jid types.JID) string {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	info, err := s.client.GetProfilePictureInfo(ctx, jid, &whatsmeow.GetProfilePictureParams{Preview: true})
	if err != nil || info == nil {
		return ""
	}
	return info.URL
}

func (s *bridgeState) handleReceipt(v *events.Receipt) {
	if v.Type == events.ReceiptTypeRead || v.Type == events.ReceiptTypeReadSelf {
		payload := map[string]any{
			"event":       "receipt",
			"receiptType": string(v.Type),
			"messageIds":  v.MessageIDs,
			"chatId":      v.Chat.String(),
			"senderJid":   v.Sender.String(),
			"timestamp":   v.Timestamp,
		}
		s.enqueueWebhook(payload)
	}
}

func (s *bridgeState) getMessageType(msg *waProto.Message) string {
	switch {
	case msg.GetConversation() != "" || msg.GetExtendedTextMessage() != nil:
		return "text"
	case msg.GetImageMessage() != nil:
		return "image"
	case msg.GetAudioMessage() != nil:
		return "audio"
	case msg.GetVideoMessage() != nil:
		return "video"
	case msg.GetDocumentMessage() != nil:
		return "document"
	case msg.GetStickerMessage() != nil:
		return "sticker"
	case msg.GetLocationMessage() != nil:
		return "location"
	case msg.GetContactMessage() != nil:
		return "contact"
	case msg.GetButtonsResponseMessage() != nil:
		return "button_response"
	case msg.GetListResponseMessage() != nil:
		return "list_response"
	default:
		return "unknown"
	}
}

func (s *bridgeState) extractMediaInfo(msg *waProto.Message) map[string]any {
	switch {
	case msg.GetImageMessage() != nil:
		img := msg.GetImageMessage()
		return map[string]any{
			"type":          "image",
			"url":           img.GetURL(),
			"mimetype":      img.GetMimetype(),
			"caption":       img.GetCaption(),
			"fileSha256":    img.GetFileSHA256(),
			"fileEncSha256": img.GetFileEncSHA256(),
			"fileLength":    img.GetFileLength(),
			"height":        img.GetHeight(),
			"width":         img.GetWidth(),
			"mediaKey":      img.GetMediaKey(),
		}
	case msg.GetAudioMessage() != nil:
		audio := msg.GetAudioMessage()
		return map[string]any{
			"type":          "audio",
			"url":           audio.GetURL(),
			"mimetype":      audio.GetMimetype(),
			"fileSha256":    audio.GetFileSHA256(),
			"fileEncSha256": audio.GetFileEncSHA256(),
			"fileLength":    audio.GetFileLength(),
			"seconds":       audio.GetSeconds(),
			"ptt":           audio.GetPTT(),
			"mediaKey":      audio.GetMediaKey(),
		}
	case msg.GetVideoMessage() != nil:
		video := msg.GetVideoMessage()
		return map[string]any{
			"type":          "video",
			"url":           video.GetURL(),
			"mimetype":      video.GetMimetype(),
			"caption":       video.GetCaption(),
			"fileSha256":    video.GetFileSHA256(),
			"fileEncSha256": video.GetFileEncSHA256(),
			"fileLength":    video.GetFileLength(),
			"seconds":       video.GetSeconds(),
			"mediaKey":      video.GetMediaKey(),
		}
	case msg.GetDocumentMessage() != nil:
		doc := msg.GetDocumentMessage()
		return map[string]any{
			"type":          "document",
			"url":           doc.GetURL(),
			"mimetype":      doc.GetMimetype(),
			"title":         doc.GetTitle(),
			"fileName":      doc.GetFileName(),
			"fileSha256":    doc.GetFileSHA256(),
			"fileEncSha256": doc.GetFileEncSHA256(),
			"fileLength":    doc.GetFileLength(),
			"pageCount":     doc.GetPageCount(),
			"mediaKey":      doc.GetMediaKey(),
		}
	case msg.GetStickerMessage() != nil:
		sticker := msg.GetStickerMessage()
		return map[string]any{
			"type":          "sticker",
			"url":           sticker.GetURL(),
			"mimetype":      sticker.GetMimetype(),
			"fileSha256":    sticker.GetFileSHA256(),
			"fileEncSha256": sticker.GetFileEncSHA256(),
			"fileLength":    sticker.GetFileLength(),
			"height":        sticker.GetHeight(),
			"width":         sticker.GetWidth(),
			"mediaKey":      sticker.GetMediaKey(),
		}
	default:
		return nil
	}
}

func (s *bridgeState) downloadMedia(mediaURL string) ([]byte, string, error) {
	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Get(mediaURL)
	if err != nil {
		return nil, "", fmt.Errorf("download: %w", err)
	}
	defer resp.Body.Close()

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, "", fmt.Errorf("read: %w", err)
	}

	contentType := resp.Header.Get("Content-Type")
	return data, contentType, nil
}

func (s *bridgeState) enqueueWebhook(payload any) {
	select {
	case s.webhookQueue <- webhookJob{Payload: payload, Attempts: 0}:
	default:
		log.Println("[whatsmeow-bridge] webhook queue full, dropping message")
		s.metrics.webhookFailures.Add(1)
	}
}

func (s *bridgeState) processWebhookQueue() {
	for job := range s.webhookQueue {
		s.deliverWebhookWithRetry(job)
	}
}

func (s *bridgeState) deliverWebhookWithRetry(job webhookJob) {
	maxRetries := 3
	for attempt := 0; attempt <= maxRetries; attempt++ {
		err := s.postWebhook(job.Payload)
		if err == nil {
			return
		}

		job.Attempts = attempt + 1
		job.LastErr = err

		if attempt < maxRetries {
			s.metrics.webhookRetries.Add(1)
			backoff := time.Duration(math.Pow(2, float64(attempt))) * time.Second
			log.Printf("[whatsmeow-bridge] webhook attempt %d failed, retrying in %v: %v", attempt+1, backoff, err)
			time.Sleep(backoff)
		} else {
			s.metrics.webhookFailures.Add(1)
			log.Printf("[whatsmeow-bridge] webhook failed after %d attempts: %v", maxRetries+1, err)
		}
	}
}

func (s *bridgeState) postWebhook(payload any) error {
	if s.webhookURL == "" {
		return fmt.Errorf("WHATSMEOW_WEBHOOK_URL not configured")
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal: %w", err)
	}

	req, err := http.NewRequest(http.MethodPost, s.webhookURL, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "whatsmeow-bridge/"+buildVersion)
	if s.secret != "" {
		req.Header.Set("Authorization", "Bearer "+s.secret)
	}

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("http: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		return fmt.Errorf("webhook returned %s", resp.Status)
	}

	return nil
}

func (s *bridgeState) handleStatus(w http.ResponseWriter, _ *http.Request) {
	s.mu.RLock()
	connected := s.connected
	hasQR := s.currentQR != ""
	qrExpiresAt := timePtr(s.currentQRUntil)
	pairingEvent := s.pairingEvent
	hasPairingCode := s.pairingCode != ""
	pairingPhone := s.pairingPhone
	pairingExpiresAt := timePtr(s.pairingExpires)
	passkeyPending := s.passkeyPending
	lastError := s.lastError
	s.mu.RUnlock()

	identity := s.accountIdentity()
	writeJSON(w, http.StatusOK, map[string]any{
		"connected":        connected,
		"hasQR":            hasQR,
		"qrExpiresAt":      qrExpiresAt,
		"pairingEvent":     pairingEvent,
		"hasPairingCode":   hasPairingCode,
		"pairingPhone":     pairingPhone,
		"pairingExpiresAt": pairingExpiresAt,
		"passkeyPending":   passkeyPending,
		"lastError":        lastError,
		"jid":              identity["jid"],
		"phone":            identity["phone"],
		"pushName":         identity["pushName"],
		"businessName":     identity["businessName"],
		"avatarUrl":        identity["avatarUrl"],
	})
}

func (s *bridgeState) handleHealth(w http.ResponseWriter, _ *http.Request) {
	s.mu.RLock()
	connected := s.connected
	hasQR := s.currentQR != ""
	pairingEvent := s.pairingEvent
	hasPairingCode := s.pairingCode != ""
	passkeyPending := s.passkeyPending
	lastErr := s.lastError
	webhookURL := s.webhookURL
	s.mu.RUnlock()
	identity := s.accountIdentity()

	writeJSON(w, http.StatusOK, healthResponse{
		Connected:        connected,
		HasQR:            hasQR,
		PairingEvent:     pairingEvent,
		HasPairingCode:   hasPairingCode,
		PasskeyPending:   passkeyPending,
		JID:              identity["jid"],
		Phone:            identity["phone"],
		PushName:         identity["pushName"],
		BusinessName:     identity["businessName"],
		AvatarURL:        identity["avatarUrl"],
		LastError:        lastErr,
		UptimeSeconds:    int64(time.Since(startupTime).Seconds()),
		Version:          buildVersion,
		MessagesReceived: s.metrics.messagesReceived.Load(),
		MessagesSent:     s.metrics.messagesSent.Load(),
		ReconnectCount:   s.metrics.reconnectCount.Load(),
		WebhookRetries:   s.metrics.webhookRetries.Load(),
		WebhookFailures:  s.metrics.webhookFailures.Load(),
		WebhookQueueLen:  len(s.webhookQueue),
		WebhookURL:       webhookURL,
	})
}

func (s *bridgeState) handleQR(w http.ResponseWriter, _ *http.Request) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	writeJSON(w, http.StatusOK, map[string]any{
		"connected":        s.connected,
		"qr":               s.currentQR,
		"qrExpiresAt":      timePtr(s.currentQRUntil),
		"pairingEvent":     s.pairingEvent,
		"pairingCode":      s.pairingCode,
		"pairingPhone":     s.pairingPhone,
		"pairingExpiresAt": timePtr(s.pairingExpires),
		"passkeyPending":   s.passkeyPending,
	})
}

func (s *bridgeState) handlePairCode(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	if !s.authorized(r) {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	var input pairCodeRequest
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json"})
		return
	}
	if strings.TrimSpace(input.Phone) == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "phone is required"})
		return
	}

	if s.client.Store.ID != nil || s.client.IsLoggedIn() {
		writeJSON(w, http.StatusConflict, map[string]string{"error": "client already paired"})
		return
	}

	select {
	case <-s.pairReadyCh:
	case <-time.After(10 * time.Second):
		writeJSON(w, http.StatusConflict, map[string]string{"error": "pairing websocket is not ready yet; wait for QR and try again"})
		return
	}

	clientDisplayName := strings.TrimSpace(input.ClientDisplayName)
	if clientDisplayName == "" {
		clientDisplayName = env("WHATSMEOW_PAIR_DISPLAY_NAME", "Chrome (Windows)")
	}
	clientType := pairClientType(input.ClientType)
	ctx, cancel := context.WithTimeout(r.Context(), 20*time.Second)
	defer cancel()

	code, err := s.client.PairPhone(ctx, input.Phone, input.ShowPushNotification, clientType, clientDisplayName)
	if err != nil {
		s.setError(fmt.Errorf("pair phone: %w", err))
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": err.Error()})
		return
	}

	expiresAt := time.Now().Add(160 * time.Second)
	s.mu.Lock()
	s.pairingCode = code
	s.pairingPhone = input.Phone
	s.pairingExpires = expiresAt
	s.pairingEvent = "pair-code"
	s.mu.Unlock()

	writeJSON(w, http.StatusOK, map[string]any{
		"code":              code,
		"phone":             input.Phone,
		"clientType":        string(clientType),
		"clientDisplayName": clientDisplayName,
		"expiresAt":         expiresAt,
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

	s.metrics.messagesSent.Add(1)
	log.Printf("[whatsmeow-bridge] message sent to %s: id=%s", input.To, resp.ID)

	writeJSON(w, http.StatusAccepted, map[string]any{
		"sent":      true,
		"messageId": resp.ID,
		"timestamp": resp.Timestamp,
	})
}

func (s *bridgeState) handleSendMedia(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	if !s.authorized(r) {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	var input sendMediaRequest
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json"})
		return
	}
	if input.To == "" || input.MediaURL == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "to and mediaUrl are required"})
		return
	}

	jid, err := types.ParseJID(normalizeJID(input.To))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	data, contentType, err := s.downloadMedia(input.MediaURL)
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": fmt.Sprintf("download failed: %v", err)})
		return
	}

	mediaType := s.resolveMediaType(input.MediaType, contentType)
	uploaded, err := s.client.Upload(context.Background(), data, mediaType)
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": fmt.Sprintf("upload failed: %v", err)})
		return
	}

	var msg *waProto.Message
	switch mediaType {
	case whatsmeow.MediaImage:
		msg = &waProto.Message{
			ImageMessage: &waProto.ImageMessage{
				URL:           proto.String(uploaded.URL),
				Mimetype:      proto.String(contentType),
				Caption:       proto.String(input.Caption),
				FileSHA256:    uploaded.FileSHA256,
				FileEncSHA256: uploaded.FileEncSHA256,
				FileLength:    proto.Uint64(uploaded.FileLength),
				MediaKey:      uploaded.MediaKey,
			},
		}
	case whatsmeow.MediaVideo:
		msg = &waProto.Message{
			VideoMessage: &waProto.VideoMessage{
				URL:           proto.String(uploaded.URL),
				Mimetype:      proto.String(contentType),
				Caption:       proto.String(input.Caption),
				FileSHA256:    uploaded.FileSHA256,
				FileEncSHA256: uploaded.FileEncSHA256,
				FileLength:    proto.Uint64(uploaded.FileLength),
				MediaKey:      uploaded.MediaKey,
			},
		}
	case whatsmeow.MediaAudio:
		msg = &waProto.Message{
			AudioMessage: &waProto.AudioMessage{
				URL:           proto.String(uploaded.URL),
				Mimetype:      proto.String(contentType),
				FileSHA256:    uploaded.FileSHA256,
				FileEncSHA256: uploaded.FileEncSHA256,
				FileLength:    proto.Uint64(uploaded.FileLength),
				MediaKey:      uploaded.MediaKey,
			},
		}
	default:
		docName := input.FileName
		if docName == "" {
			docName = "document"
		}
		msg = &waProto.Message{
			DocumentMessage: &waProto.DocumentMessage{
				URL:           proto.String(uploaded.URL),
				Mimetype:      proto.String(contentType),
				Title:         proto.String(docName),
				FileName:      proto.String(docName),
				FileSHA256:    uploaded.FileSHA256,
				FileEncSHA256: uploaded.FileEncSHA256,
				FileLength:    proto.Uint64(uploaded.FileLength),
				MediaKey:      uploaded.MediaKey,
			},
		}
	}

	resp, err := s.client.SendMessage(context.Background(), jid, msg)
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": err.Error()})
		return
	}

	s.metrics.messagesSent.Add(1)
	log.Printf("[whatsmeow-bridge] media sent to %s: id=%s type=%s", input.To, resp.ID, input.MediaType)

	writeJSON(w, http.StatusAccepted, map[string]any{
		"sent":      true,
		"messageId": resp.ID,
		"timestamp": resp.Timestamp,
	})
}

func (s *bridgeState) resolveMediaType(requestType, contentType string) whatsmeow.MediaType {
	switch strings.ToLower(requestType) {
	case "image", "photo":
		return whatsmeow.MediaImage
	case "video":
		return whatsmeow.MediaVideo
	case "audio", "voice":
		return whatsmeow.MediaAudio
	case "document", "file":
		return whatsmeow.MediaDocument
	}

	switch {
	case strings.HasPrefix(contentType, "image/"):
		return whatsmeow.MediaImage
	case strings.HasPrefix(contentType, "video/"):
		return whatsmeow.MediaVideo
	case strings.HasPrefix(contentType, "audio/"):
		return whatsmeow.MediaAudio
	default:
		return whatsmeow.MediaDocument
	}
}

func (s *bridgeState) handleSendButtons(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	if !s.authorized(r) {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	var input sendButtonsRequest
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json"})
		return
	}
	if input.To == "" || input.Text == "" || len(input.Buttons) == 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "to, text, and buttons are required"})
		return
	}

	jid, err := types.ParseJID(normalizeJID(input.To))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	buttonType := waProto.ButtonsMessage_Button_RESPONSE
	headerType := waProto.ButtonsMessage_EMPTY
	var buttons []*waProto.ButtonsMessage_Button
	for _, b := range input.Buttons {
		btnID := b.ID
		if btnID == "" {
			btnID = b.Title
		}
		buttons = append(buttons, &waProto.ButtonsMessage_Button{
			ButtonID: proto.String(btnID),
			ButtonText: &waProto.ButtonsMessage_Button_ButtonText{
				DisplayText: proto.String(b.Title),
			},
			Type: &buttonType,
		})
	}

	resp, err := s.client.SendMessage(context.Background(), jid, &waProto.Message{
		ButtonsMessage: &waProto.ButtonsMessage{
			ContentText: proto.String(input.Text),
			FooterText:  proto.String(input.Footer),
			HeaderType:  &headerType,
			Buttons:     buttons,
		},
	})
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": err.Error()})
		return
	}

	s.metrics.messagesSent.Add(1)
	log.Printf("[whatsmeow-bridge] buttons sent to %s: id=%s buttons=%d", input.To, resp.ID, len(input.Buttons))

	writeJSON(w, http.StatusAccepted, map[string]any{
		"sent":      true,
		"messageId": resp.ID,
		"timestamp": resp.Timestamp,
	})
}

func (s *bridgeState) handleSendList(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	if !s.authorized(r) {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	var input sendListRequest
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json"})
		return
	}
	if input.To == "" || len(input.Sections) == 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "to and sections are required"})
		return
	}

	jid, err := types.ParseJID(normalizeJID(input.To))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	btnText := input.ButtonText
	if btnText == "" {
		btnText = "Ver opções"
	}

	var sections []*waProto.ListMessage_Section
	for _, sec := range input.Sections {
		var rows []*waProto.ListMessage_Row
		for _, row := range sec.Rows {
			rID := row.ID
			if rID == "" {
				rID = row.Title
			}
			r := &waProto.ListMessage_Row{
				Title: proto.String(row.Title),
				RowID: proto.String(rID),
			}
			if row.Description != "" {
				r.Description = proto.String(row.Description)
			}
			rows = append(rows, r)
		}
		section := &waProto.ListMessage_Section{
			Rows: rows,
		}
		if sec.Title != "" {
			section.Title = proto.String(sec.Title)
		}
		sections = append(sections, section)
	}

	listMsg := &waProto.ListMessage{
		ButtonText: proto.String(btnText),
		ListType:   waProto.ListMessage_SINGLE_SELECT.Enum(),
		Sections:   sections,
	}

	if input.Title != "" {
		listMsg.Title = proto.String(input.Title)
	}
	if input.Description != "" {
		listMsg.Description = proto.String(input.Description)
	}

	resp, err := s.client.SendMessage(context.Background(), jid, &waProto.Message{
		ListMessage: listMsg,
	})
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": err.Error()})
		return
	}

	s.metrics.messagesSent.Add(1)
	log.Printf("[whatsmeow-bridge] list sent to %s: id=%s sections=%d", input.To, resp.ID, len(input.Sections))

	writeJSON(w, http.StatusAccepted, map[string]any{
		"sent":      true,
		"messageId": resp.ID,
		"timestamp": resp.Timestamp,
	})
}

func (s *bridgeState) handleSendReply(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	if !s.authorized(r) {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	var input sendReplyRequest
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json"})
		return
	}
	if input.To == "" || input.Text == "" || input.ReplyToID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "to, text, and replyToId are required"})
		return
	}

	jid, err := types.ParseJID(normalizeJID(input.To))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	msg := &waProto.Message{
		ExtendedTextMessage: &waProto.ExtendedTextMessage{
			Text: proto.String(input.Text),
			ContextInfo: &waProto.ContextInfo{
				StanzaID:      proto.String(input.ReplyToID),
				Participant:   proto.String(jid.String()),
				QuotedMessage: &waProto.Message{Conversation: proto.String("")},
			},
		},
	}

	resp, err := s.client.SendMessage(context.Background(), jid, msg)
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": err.Error()})
		return
	}

	s.metrics.messagesSent.Add(1)
	log.Printf("[whatsmeow-bridge] reply sent to %s: id=%s replyTo=%s", input.To, resp.ID, input.ReplyToID)

	writeJSON(w, http.StatusAccepted, map[string]any{
		"sent":      true,
		"messageId": resp.ID,
		"timestamp": resp.Timestamp,
	})
}

func (s *bridgeState) handleSendReaction(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	if !s.authorized(r) {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	var input sendReactionRequest
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json"})
		return
	}
	if input.To == "" || input.MessageID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "to and messageId are required"})
		return
	}

	jid, err := types.ParseJID(normalizeJID(input.To))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	reaction := &waProto.ReactionMessage{
		Key: &waProto.MessageKey{
			RemoteJID: proto.String(jid.String()),
			FromMe:    proto.Bool(true),
			ID:        proto.String(input.MessageID),
		},
		Text: proto.String(input.Emoji),
	}

	resp, err := s.client.SendMessage(context.Background(), jid, &waProto.Message{
		ReactionMessage: reaction,
	})
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": err.Error()})
		return
	}

	s.metrics.messagesSent.Add(1)
	log.Printf("[whatsmeow-bridge] reaction sent to %s: id=%s emoji=%s", input.To, resp.ID, input.Emoji)

	writeJSON(w, http.StatusAccepted, map[string]any{
		"sent":      true,
		"messageId": resp.ID,
		"timestamp": resp.Timestamp,
	})
}

func (s *bridgeState) handleSendPoll(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	if !s.authorized(r) {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	var input sendPollRequest
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json"})
		return
	}
	if input.To == "" || input.Question == "" || len(input.Options) < 2 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "to, question, and at least 2 options are required"})
		return
	}

	jid, err := types.ParseJID(normalizeJID(input.To))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	var optionVals []*waProto.PollCreationMessage_Option
	for _, opt := range input.Options {
		optionVals = append(optionVals, &waProto.PollCreationMessage_Option{
			OptionName: proto.String(opt),
		})
	}

	maxAnswers := input.MaxAnswers
	if maxAnswers < 1 {
		maxAnswers = 1
	}

	poll := &waProto.PollCreationMessage{
		Name:                   proto.String(input.Question),
		Options:                optionVals,
		SelectableOptionsCount: proto.Uint32(uint32(maxAnswers)),
	}

	resp, err := s.client.SendMessage(context.Background(), jid, &waProto.Message{
		PollCreationMessage: poll,
	})
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": err.Error()})
		return
	}

	s.metrics.messagesSent.Add(1)
	log.Printf("[whatsmeow-bridge] poll sent to %s: id=%s options=%d", input.To, resp.ID, len(input.Options))

	writeJSON(w, http.StatusAccepted, map[string]any{
		"sent":      true,
		"messageId": resp.ID,
		"timestamp": resp.Timestamp,
	})
}

func (s *bridgeState) handleSendLocation(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	if !s.authorized(r) {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	var input sendLocationRequest
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json"})
		return
	}
	if input.To == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "to is required"})
		return
	}

	jid, err := types.ParseJID(normalizeJID(input.To))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	loc := &waProto.LocationMessage{
		DegreesLatitude:  proto.Float64(input.Latitude),
		DegreesLongitude: proto.Float64(input.Longitude),
	}

	if input.Name != "" {
		loc.Name = proto.String(input.Name)
	}
	if input.Address != "" {
		loc.Address = proto.String(input.Address)
	}

	resp, err := s.client.SendMessage(context.Background(), jid, &waProto.Message{
		LocationMessage: loc,
	})
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": err.Error()})
		return
	}

	s.metrics.messagesSent.Add(1)
	log.Printf("[whatsmeow-bridge] location sent to %s: id=%s lat=%f lng=%f", input.To, resp.ID, input.Latitude, input.Longitude)

	writeJSON(w, http.StatusAccepted, map[string]any{
		"sent":      true,
		"messageId": resp.ID,
		"timestamp": resp.Timestamp,
	})
}

func (s *bridgeState) handleSendContact(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	if !s.authorized(r) {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	var input sendContactRequest
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json"})
		return
	}
	if input.To == "" || input.ContactName == "" || input.Phone == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "to, contactName, and phone are required"})
		return
	}

	jid, err := types.ParseJID(normalizeJID(input.To))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	contact := &waProto.ContactMessage{
		DisplayName: proto.String(input.ContactName),
		Vcard:       proto.String(s.buildVCard(input.ContactName, input.Phone)),
	}

	resp, err := s.client.SendMessage(context.Background(), jid, &waProto.Message{
		ContactMessage: contact,
	})
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": err.Error()})
		return
	}

	s.metrics.messagesSent.Add(1)
	log.Printf("[whatsmeow-bridge] contact sent to %s: id=%s contact=%s", input.To, resp.ID, input.ContactName)

	writeJSON(w, http.StatusAccepted, map[string]any{
		"sent":      true,
		"messageId": resp.ID,
		"timestamp": resp.Timestamp,
	})
}

func (s *bridgeState) buildVCard(name, phone string) string {
	return fmt.Sprintf(`BEGIN:VCARD
VERSION:3.0
FN:%s
TEL;TYPE=CELL:%s
END:VCARD`, name, phone)
}

func (s *bridgeState) handleSendSticker(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	if !s.authorized(r) {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	var input sendStickerRequest
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json"})
		return
	}
	if input.To == "" || input.MediaURL == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "to and mediaUrl are required"})
		return
	}

	jid, err := types.ParseJID(normalizeJID(input.To))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	data, _, err := s.downloadMedia(input.MediaURL)
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": fmt.Sprintf("download failed: %v", err)})
		return
	}

	uploaded, err := s.client.Upload(context.Background(), data, whatsmeow.MediaImage)
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": fmt.Sprintf("upload failed: %v", err)})
		return
	}

	sticker := &waProto.StickerMessage{
		URL:           proto.String(uploaded.URL),
		FileSHA256:    uploaded.FileSHA256,
		FileEncSHA256: uploaded.FileEncSHA256,
		FileLength:    proto.Uint64(uploaded.FileLength),
		MediaKey:      uploaded.MediaKey,
		Mimetype:      proto.String("image/webp"),
	}

	resp, err := s.client.SendMessage(context.Background(), jid, &waProto.Message{
		StickerMessage: sticker,
	})
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": err.Error()})
		return
	}

	s.metrics.messagesSent.Add(1)
	log.Printf("[whatsmeow-bridge] sticker sent to %s: id=%s", input.To, resp.ID)

	writeJSON(w, http.StatusAccepted, map[string]any{
		"sent":      true,
		"messageId": resp.ID,
		"timestamp": resp.Timestamp,
	})
}

func (s *bridgeState) handleSendDelete(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	if !s.authorized(r) {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	var input sendDeleteRequest
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json"})
		return
	}
	if input.To == "" || input.MessageID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "to and messageId are required"})
		return
	}

	jid, err := types.ParseJID(normalizeJID(input.To))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	_, err = s.client.RevokeMessage(context.Background(), jid, input.MessageID)
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": err.Error()})
		return
	}

	s.metrics.messagesSent.Add(1)
	log.Printf("[whatsmeow-bridge] message deleted %s for %s", input.MessageID, input.To)

	writeJSON(w, http.StatusAccepted, map[string]any{
		"sent": true,
	})
}

func (s *bridgeState) handlePresence(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	if !s.authorized(r) {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	var input struct {
		State string `json:"state"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json"})
		return
	}

	presence := types.PresenceAvailable
	if input.State == "offline" || input.State == "unavailable" {
		presence = types.PresenceUnavailable
	}

	err := s.client.SendPresence(context.Background(), presence)
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"sent": true})
}

func (s *bridgeState) handleTyping(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	if !s.authorized(r) {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	var input typingRequest
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json"})
		return
	}
	if input.To == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "to is required"})
		return
	}

	jid, err := types.ParseJID(normalizeJID(input.To))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	var chatState types.ChatPresence
	var mediaState types.ChatPresenceMedia
	switch input.State {
	case "typing":
		chatState = types.ChatPresenceComposing
		mediaState = types.ChatPresenceMediaText
	case "recording":
		chatState = types.ChatPresenceComposing
		mediaState = types.ChatPresenceMediaText
	case "paused", "":
		chatState = ""
		mediaState = types.ChatPresenceMediaText
	default:
		chatState = ""
		mediaState = types.ChatPresenceMediaText
	}

	err = s.client.SendChatPresence(context.Background(), jid, chatState, mediaState)
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"sent": true})
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

	log.Printf("[whatsmeow-bridge] webhook configured: %s", input.WebhookURL)

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
	if err := s.client.Logout(context.Background()); err != nil && err != sql.ErrNoRows && err != whatsmeow.ErrNotLoggedIn {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	s.mu.Lock()
	s.connected = false
	s.currentQR = ""
	s.currentQRUntil = time.Time{}
	s.pairingCode = ""
	s.pairingPhone = ""
	s.pairingExpires = time.Time{}
	s.pairingEvent = "logged_out"
	s.passkeyPending = false
	s.lastError = ""
	s.mu.Unlock()
	go s.connectWithRetry()
	writeJSON(w, http.StatusOK, map[string]bool{"loggedOut": true})
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

func pairClientType(value string) whatsmeow.PairClientType {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "edge":
		return whatsmeow.PairClientEdge
	case "firefox":
		return whatsmeow.PairClientFirefox
	case "safari":
		return whatsmeow.PairClientSafari
	case "opera":
		return whatsmeow.PairClientOpera
	case "electron":
		return whatsmeow.PairClientElectron
	case "macos", "mac":
		return whatsmeow.PairClientMacOS
	case "android":
		return whatsmeow.PairClientAndroid
	case "other":
		return whatsmeow.PairClientOtherWebClient
	default:
		return whatsmeow.PairClientChrome
	}
}

func timePtr(value time.Time) any {
	if value.IsZero() {
		return nil
	}
	return value
}

func jidString(client *whatsmeow.Client) string {
	if client == nil || client.Store == nil || client.Store.ID == nil {
		return ""
	}
	return client.Store.ID.String()
}

func (s *bridgeState) accountIdentity() map[string]string {
	out := map[string]string{
		"jid":          "",
		"phone":        "",
		"pushName":     "",
		"businessName": "",
		"avatarUrl":    "",
	}
	if s == nil || s.client == nil || s.client.Store == nil || s.client.Store.ID == nil {
		return out
	}
	jid := *s.client.Store.ID
	out["jid"] = jid.String()
	out["phone"] = jid.User
	out["pushName"] = s.client.Store.PushName
	out["businessName"] = s.client.Store.BusinessName
	out["avatarUrl"] = s.getProfilePictureURL(jid)
	return out
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
