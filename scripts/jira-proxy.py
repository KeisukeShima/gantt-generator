#!/usr/bin/env python3
"""
JIRA CORS プロキシ for wbs-planner.html
=======================================
ブラウザからの JIRA REST API リクエストを中継し、CORS ヘッダーを付与します。

使い方:
  python3 scripts/jira-proxy.py          # ポート 8001 で起動
  python3 scripts/jira-proxy.py 9000     # ポート指定

wbs-planner.html の JIRA タブ → 接続設定 →「CORS プロキシ URL」に
  http://localhost:8001
を設定してから「接続テスト」してください。
"""

import sys
import urllib.request
import urllib.error
from http.server import HTTPServer, BaseHTTPRequestHandler

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8001

CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept, X-Jira-Site',
}


class ProxyHandler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        for k, v in CORS_HEADERS.items():
            self.send_header(k, v)
        self.end_headers()

    def do_GET(self):
        self._proxy()

    def do_POST(self):
        self._proxy()

    def do_PUT(self):
        self._proxy()

    def _proxy(self):
        jira_site = self.headers.get('X-Jira-Site', '').rstrip('/')
        if not jira_site:
            self.send_error(400, 'Missing X-Jira-Site header')
            return

        target = jira_site + self.path  # e.g. https://xxx.atlassian.net/rest/api/3/myself
        auth = self.headers.get('Authorization', '')
        length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(length) if length else None

        req = urllib.request.Request(target, data=body, method=self.command)
        if auth:
            req.add_header('Authorization', auth)
        req.add_header('Accept', 'application/json')
        if body:
            req.add_header('Content-Type', 'application/json')

        try:
            with urllib.request.urlopen(req) as r:
                data = r.read()
                code = r.status
        except urllib.error.HTTPError as e:
            data = e.read()
            code = e.code

        self.send_response(code)
        for k, v in CORS_HEADERS.items():
            self.send_header(k, v)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, fmt, *args):
        # 最小限のログ出力
        print(f'[proxy] {self.command} {self.path} -> {args[1] if len(args) > 1 else "?"}')


if __name__ == '__main__':
    server = HTTPServer(('localhost', PORT), ProxyHandler)
    print(f'JIRA CORS プロキシ起動中: http://localhost:{PORT}')
    print('wbs-planner.html の「CORS プロキシ URL」に上記 URL を設定してください。')
    print('停止: Ctrl+C')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\n停止しました。')
