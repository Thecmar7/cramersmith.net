package bluesky

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

const host = "https://bsky.social"

type Client struct {
	handle   string
	password string
}

func New(handle, appPassword string) *Client {
	return &Client{handle: handle, password: appPassword}
}

// Post creates a new post on Bluesky. Text is truncated to 300 chars if needed.
func (c *Client) Post(ctx context.Context, text string) error {
	// Bluesky's character limit
	runes := []rune(text)
	if len(runes) > 300 {
		text = string(runes[:297]) + "..."
	}

	token, did, err := c.createSession(ctx)
	if err != nil {
		return fmt.Errorf("bluesky auth: %w", err)
	}

	record := map[string]any{
		"$type":     "app.bsky.feed.post",
		"text":      text,
		"createdAt": time.Now().UTC().Format(time.RFC3339),
	}

	body := map[string]any{
		"repo":       did,
		"collection": "app.bsky.feed.post",
		"record":     record,
	}

	if err := c.do(ctx, "POST", "/xrpc/com.atproto.repo.createRecord", token, body, nil); err != nil {
		return fmt.Errorf("bluesky create record: %w", err)
	}
	return nil
}

func (c *Client) createSession(ctx context.Context) (accessJwt, did string, err error) {
	body := map[string]string{
		"identifier": c.handle,
		"password":   c.password,
	}
	var resp struct {
		AccessJwt string `json:"accessJwt"`
		DID       string `json:"did"`
	}
	if err := c.do(ctx, "POST", "/xrpc/com.atproto.server.createSession", "", body, &resp); err != nil {
		return "", "", err
	}
	return resp.AccessJwt, resp.DID, nil
}

func (c *Client) do(ctx context.Context, method, path, token string, body, out any) error {
	b, err := json.Marshal(body)
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, method, host+path, bytes.NewReader(b))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		var e struct {
			Message string `json:"message"`
		}
		json.NewDecoder(resp.Body).Decode(&e)
		return fmt.Errorf("HTTP %d: %s", resp.StatusCode, e.Message)
	}
	if out != nil {
		return json.NewDecoder(resp.Body).Decode(out)
	}
	return nil
}
