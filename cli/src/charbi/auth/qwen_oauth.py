#!/usr/bin/env python3
"""
🔐 Qwen OAuth Authentication - Flujo Automático Completo
"""

import os
import json
import time
import hashlib
import secrets
import webbrowser
import threading
import base64
from pathlib import Path
from datetime import datetime, timedelta
from typing import Optional, Dict, Tuple
from urllib.parse import urlparse, parse_qs
from http.server import HTTPServer, BaseHTTPRequestHandler
from rich.console import Console
from rich.panel import Panel
from rich.prompt import Prompt
from rich.live import Live
from rich.spinner import Spinner
import httpx

console = Console()

class QwenOAuth:
    """
    Autenticación OAuth 2.0 para Qwen (Alibaba Cloud)
    """
    
    AUTH_BASE_URL = "https://account.aliyun.com/oauth/authorize"
    TOKEN_URL = "https://oauth.aliyun.com/v1/token"
    REVOKE_URL = "https://oauth.aliyun.com/v1/revoke"
    
    SCOPES = ["qwen:chat", "qwen:models", "qwen:embedding", "offline_access"]
    
    LOCAL_HOST = "localhost"
    LOCAL_PORT = 8085
    REDIRECT_URI = f"http://{LOCAL_HOST}:{LOCAL_PORT}/callback"
    
    def __init__(self, config_dir: Optional[Path] = None):
        self.config_dir = config_dir or Path.home() / ".charbi-agent" / "cli" / "config"
        self.config_dir.mkdir(parents=True, exist_ok=True)
        self.tokens_file = self.config_dir / "qwen_tokens.json"
        self.credentials_file = self.config_dir / "qwen_credentials.json"
        
        self.client_id, self.client_secret = self._load_credentials()
        
        self.state = secrets.token_urlsafe(32)
        self.code_verifier = secrets.token_urlsafe(64)
        
        self.auth_code = None
        self.received_state = None
        self.server_error = None
    
    def _load_credentials(self) -> Tuple[str, str]:
        if os.getenv("QWEN_CLIENT_ID") and os.getenv("QWEN_CLIENT_SECRET"):
            return os.getenv("QWEN_CLIENT_ID"), os.getenv("QWEN_CLIENT_SECRET")
        
        if self.credentials_file.exists():
            with open(self.credentials_file, 'r') as f:
                creds = json.load(f)
                return creds.get("client_id", ""), creds.get("client_secret", "")
        
        return "", "" # Empty for now, will be prompted if needed in authenticate()

    def _generate_code_challenge(self) -> str:
        digest = hashlib.sha256(self.code_verifier.encode()).digest()
        return base64.urlsafe_b64encode(digest).decode().replace('=', '')
    
    def generate_auth_url(self) -> str:
        code_challenge = self._generate_code_challenge()
        params = {
            "response_type": "code",
            "client_id": self.client_id,
            "redirect_uri": self.REDIRECT_URI,
            "scope": " ".join(self.SCOPES),
            "state": self.state,
            "code_challenge": code_challenge,
            "code_challenge_method": "S256",
            "access_type": "offline",
            "prompt": "consent"
        }
        return f"{self.AUTH_BASE_URL}?" + "&".join(f"{k}={v}" for k, v in params.items())
    
    def _create_callback_handler(self):
        oauth_self = self
        class OAuthCallbackHandler(BaseHTTPRequestHandler):
            def do_GET(self):
                parsed = urlparse(self.path)
                if parsed.path == "/callback":
                    params = parse_qs(parsed.query)
                    oauth_self.received_state = params.get("state", [None])[0]
                    if oauth_self.received_state != oauth_self.state:
                        oauth_self.server_error = "Estado inválido"
                        self.send_response(400); self.end_headers(); self.wfile.write(b"Error: State mismatch")
                        return
                    code = params.get("code", [None])[0]
                    if code:
                        oauth_self.auth_code = code
                        self.send_response(200); self.send_header("Content-type", "text/html"); self.end_headers()
                        self.wfile.write(b"<html><body><h1>Success!</h1><p>You can close this window.</p></body></html>")
                    else:
                        oauth_self.server_error = "No code received"
                        self.send_response(400); self.end_headers(); self.wfile.write(b"Error: No code")
            def log_message(self, format, *args): pass
        return OAuthCallbackHandler
    
    def _start_local_server(self):
        handler_class = self._create_callback_handler()
        server = HTTPServer((self.LOCAL_HOST, self.LOCAL_PORT), handler_class)
        server_thread = threading.Thread(target=server.handle_request)
        server_thread.daemon = True
        server_thread.start()
        
        start_time = time.time()
        with Live(Spinner("dots", text="Esperando autorización...", style="cyan"), console=console) as live:
            while time.time() - start_time < 120:
                if self.auth_code:
                    server.server_close()
                    return self.auth_code
                if self.server_error:
                    server.server_close()
                    raise Exception(self.server_error)
                time.sleep(0.5)
        server.server_close()
        raise TimeoutError("Timeout")

    def authenticate(self) -> Dict:
        if not self.client_id or not self.client_secret:
            console.print("[yellow]⚠️  Credenciales de Qwen requeridas (Aliyun console)[/yellow]")
            self.client_id = Prompt.ask("Client ID")
            self.client_secret = Prompt.ask("Client Secret", password=True)
            with open(self.credentials_file, 'w') as f:
                json.dump({"client_id": self.client_id, "client_secret": self.client_secret}, f, indent=2)
        
        auth_url = self.generate_auth_url()
        console.print(f"\n[cyan]🌐 Abriendo navegador:[/cyan] [dim]{auth_url}[/dim]")
        webbrowser.open(auth_url)
        
        try:
            auth_code = self._start_local_server()
            tokens = self._exchange_code_for_tokens(auth_code)
            if tokens:
                self.save_tokens(tokens)
                return tokens
        except Exception as e:
            console.print(f"[red]❌ Error: {e}[/red]")
        return None

    def _exchange_code_for_tokens(self, auth_code: str):
        data = {
            "grant_type": "authorization_code",
            "code": auth_code,
            "redirect_uri": self.REDIRECT_URI,
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "code_verifier": self.code_verifier
        }
        with httpx.Client(timeout=30) as client:
            resp = client.post(self.TOKEN_URL, data=data)
            resp.raise_for_status()
            tokens = resp.json()
            tokens["expires_at"] = (datetime.now() + timedelta(seconds=tokens.get("expires_in", 3600))).isoformat()
            return tokens

    def save_tokens(self, tokens: Dict):
        with open(self.tokens_file, 'w') as f:
            json.dump(tokens, f, indent=2)
        os.chmod(self.tokens_file, 0o600)

    def load_tokens(self) -> Optional[Dict]:
        if not self.tokens_file.exists(): return None
        with open(self.tokens_file, 'r') as f:
            return json.load(f)

    def revoke_tokens(self):
        if self.tokens_file.exists(): self.tokens_file.unlink()
