package auth

import (
	"context"
	"net/http"
	"strings"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/ssm"
)

// Auth holds the admin password loaded from SSM at startup.
type Auth struct {
	password string
}

// New fetches the admin password from SSM Parameter Store.
func New(ctx context.Context, client *ssm.Client, paramName string) (*Auth, error) {
	out, err := client.GetParameter(ctx, &ssm.GetParameterInput{
		Name:           aws.String(paramName),
		WithDecryption: aws.Bool(true),
	})
	if err != nil {
		return nil, err
	}
	return &Auth{password: *out.Parameter.Value}, nil
}

// Middleware rejects requests that don't carry the correct password in
// the Authorization: Bearer <password> header.
func (a *Auth) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		token := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
		if token != a.password {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		next.ServeHTTP(w, r)
	})
}
