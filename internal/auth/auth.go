package auth

import (
	"context"
	"crypto/subtle"
	"net/http"
	"strings"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/ssm"
)

// Auth holds valid bearer tokens loaded from SSM at startup.
type Auth struct {
	tokens []string
}

// New fetches one or more bearer tokens from SSM Parameter Store.
func New(ctx context.Context, client *ssm.Client, paramNames ...string) (*Auth, error) {
	a := &Auth{}
	for _, name := range paramNames {
		out, err := client.GetParameter(ctx, &ssm.GetParameterInput{
			Name:           aws.String(name),
			WithDecryption: aws.Bool(true),
		})
		if err != nil {
			return nil, err
		}
		a.tokens = append(a.tokens, *out.Parameter.Value)
	}
	return a, nil
}

// Valid returns true if the request carries a valid bearer token.
func (a *Auth) Valid(r *http.Request) bool {
	token := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
	for _, valid := range a.tokens {
		if subtle.ConstantTimeCompare([]byte(token), []byte(valid)) == 1 {
			return true
		}
	}
	return false
}

// Middleware rejects requests that don't carry a valid token in
// the Authorization: Bearer <token> header.
func (a *Auth) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		token := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
		for _, valid := range a.tokens {
			if subtle.ConstantTimeCompare([]byte(token), []byte(valid)) == 1 {
				next.ServeHTTP(w, r)
				return
			}
		}
		http.Error(w, "unauthorized", http.StatusUnauthorized)
	})
}
