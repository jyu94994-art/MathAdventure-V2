import json
import os
import secrets
import sqlite3
import hashlib
from datetime import datetime
from http import HTTPStatus
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parent
DB_PATH = ROOT / "data" / "math_adventure.db"
HOST = "0.0.0.0"
PORT = int(os.environ.get("PORT", 80))


def now():
    return datetime.utcnow().isoformat(timespec="seconds") + "Z"


def db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def hash_password(password, salt=None):
    salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 120000)
    return salt, digest.hex()


def verify_password(password, salt, password_hash):
    _, digest = hash_password(password, salt)
    return secrets.compare_digest(digest, password_hash)


def init_db():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with db() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL UNIQUE,
                display_name TEXT NOT NULL,
                password_hash TEXT NOT NULL,
                salt TEXT NOT NULL,
                is_admin INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                last_login TEXT
            );

            CREATE TABLE IF NOT EXISTS sessions (
                token TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY(user_id) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS saves (
                user_id INTEGER PRIMARY KEY,
                save_json TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY(user_id) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS scores (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                score INTEGER NOT NULL,
                level INTEGER NOT NULL,
                world INTEGER NOT NULL,
                accuracy INTEGER NOT NULL,
                answered INTEGER NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY(user_id) REFERENCES users(id)
            );
            """
        )
        admin = conn.execute("SELECT id FROM users WHERE username = ?", ("admin",)).fetchone()
        if not admin:
            salt, password_hash = hash_password("admin123")
            conn.execute(
                """
                INSERT INTO users(username, display_name, password_hash, salt, is_admin, created_at)
                VALUES (?, ?, ?, ?, 1, ?)
                """,
                ("admin", "管理员", password_hash, salt, now()),
            )


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self):
        path = urlparse(self.path).path
        if path.startswith("/api/"):
            self.route_api("GET", path)
        else:
            super().do_GET()

    def do_POST(self):
        path = urlparse(self.path).path
        if path.startswith("/api/"):
            self.route_api("POST", path)
        else:
            self.send_error(HTTPStatus.NOT_FOUND)

    def route_api(self, method, path):
        routes = {
            ("POST", "/api/register"): self.register,
            ("POST", "/api/login"): self.login,
            ("POST", "/api/logout"): self.logout,
            ("GET", "/api/me"): self.me,
            ("GET", "/api/save"): self.get_save,
            ("POST", "/api/save"): self.post_save,
            ("POST", "/api/score"): self.post_score,
            ("GET", "/api/leaderboard"): self.leaderboard,
            ("GET", "/api/admin/users"): self.admin_users,
            ("GET", "/api/admin/stats"): self.admin_stats,
        }
        handler = routes.get((method, path))
        if not handler:
            return self.json_response({"ok": False, "error": "接口不存在"}, 404)
        try:
            handler()
        except ValueError as exc:
            self.json_response({"ok": False, "error": str(exc)}, 400)
        except PermissionError as exc:
            self.json_response({"ok": False, "error": str(exc)}, 403)
        except Exception as exc:
            self.json_response({"ok": False, "error": f"服务器错误：{exc}"}, 500)

    def read_json(self):
        length = int(self.headers.get("Content-Length", "0"))
        if length <= 0:
            return {}
        raw = self.rfile.read(length).decode("utf-8")
        return json.loads(raw)

    def json_response(self, data, status=200):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def bearer_token(self):
        auth = self.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            return auth[7:].strip()
        return ""

    def current_user(self):
        token = self.bearer_token()
        if not token:
            return None
        with db() as conn:
            return conn.execute(
                """
                SELECT users.* FROM sessions
                JOIN users ON users.id = sessions.user_id
                WHERE sessions.token = ?
                """,
                (token,),
            ).fetchone()

    def require_user(self):
        user = self.current_user()
        if not user:
            raise PermissionError("请先登录")
        return user

    def require_admin(self):
        user = self.require_user()
        if not user["is_admin"]:
            raise PermissionError("需要管理员权限")
        return user

    def public_user(self, user):
        return {
            "id": user["id"],
            "username": user["username"],
            "displayName": user["display_name"],
            "isAdmin": bool(user["is_admin"]),
            "createdAt": user["created_at"],
            "lastLogin": user["last_login"],
        }

    def register(self):
        data = self.read_json()
        username = (data.get("username") or "").strip().lower()
        display_name = (data.get("displayName") or username).strip()
        password = data.get("password") or ""
        if len(username) < 3:
            raise ValueError("用户名至少 3 个字符")
        if len(password) < 6:
            raise ValueError("密码至少 6 个字符")
        salt, password_hash = hash_password(password)
        with db() as conn:
            try:
                conn.execute(
                    """
                    INSERT INTO users(username, display_name, password_hash, salt, created_at)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    (username, display_name, password_hash, salt, now()),
                )
            except sqlite3.IntegrityError:
                raise ValueError("用户名已存在")
        self.json_response({"ok": True})

    def login(self):
        data = self.read_json()
        username = (data.get("username") or "").strip().lower()
        password = data.get("password") or ""
        with db() as conn:
            user = conn.execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()
            if not user or not verify_password(password, user["salt"], user["password_hash"]):
                raise ValueError("用户名或密码错误")
            token = secrets.token_urlsafe(32)
            conn.execute("INSERT INTO sessions(token, user_id, created_at) VALUES (?, ?, ?)", (token, user["id"], now()))
            conn.execute("UPDATE users SET last_login = ? WHERE id = ?", (now(), user["id"]))
        self.json_response({"ok": True, "token": token, "user": self.public_user(user)})

    def logout(self):
        token = self.bearer_token()
        if token:
            with db() as conn:
                conn.execute("DELETE FROM sessions WHERE token = ?", (token,))
        self.json_response({"ok": True})

    def me(self):
        user = self.current_user()
        self.json_response({"ok": True, "user": self.public_user(user) if user else None})

    def get_save(self):
        user = self.require_user()
        with db() as conn:
            row = conn.execute("SELECT save_json, updated_at FROM saves WHERE user_id = ?", (user["id"],)).fetchone()
        self.json_response({"ok": True, "save": json.loads(row["save_json"]) if row else None, "updatedAt": row["updated_at"] if row else None})

    def post_save(self):
        user = self.require_user()
        data = self.read_json()
        save = data.get("save")
        if not isinstance(save, dict):
            raise ValueError("存档格式错误")
        with db() as conn:
            conn.execute(
                """
                INSERT INTO saves(user_id, save_json, updated_at)
                VALUES (?, ?, ?)
                ON CONFLICT(user_id) DO UPDATE SET save_json = excluded.save_json, updated_at = excluded.updated_at
                """,
                (user["id"], json.dumps(save, ensure_ascii=False), now()),
            )
        self.json_response({"ok": True})

    def post_score(self):
        user = self.require_user()
        data = self.read_json()
        score = max(0, int(data.get("score", 0)))
        level = max(1, int(data.get("level", 1)))
        world = max(1, int(data.get("world", 1)))
        accuracy = max(0, min(100, int(data.get("accuracy", 0))))
        answered = max(0, int(data.get("answered", 0)))
        with db() as conn:
            conn.execute(
                """
                INSERT INTO scores(user_id, score, level, world, accuracy, answered, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (user["id"], score, level, world, accuracy, answered, now()),
            )
        self.json_response({"ok": True})

    def leaderboard(self):
        with db() as conn:
            rows = conn.execute(
                """
                SELECT users.display_name, users.username, MAX(scores.score) AS score,
                       MAX(scores.level) AS level, MAX(scores.world) AS world,
                       MAX(scores.accuracy) AS accuracy, MAX(scores.answered) AS answered
                FROM scores
                JOIN users ON users.id = scores.user_id
                GROUP BY users.id
                ORDER BY score DESC, level DESC, answered DESC
                LIMIT 20
                """
            ).fetchall()
        self.json_response({"ok": True, "items": [dict(row) for row in rows]})

    def admin_users(self):
        self.require_admin()
        with db() as conn:
            rows = conn.execute(
                """
                SELECT users.id, users.username, users.display_name, users.is_admin, users.created_at, users.last_login,
                       COALESCE(MAX(scores.score), 0) AS best_score,
                       COALESCE(MAX(scores.level), 1) AS best_level
                FROM users
                LEFT JOIN scores ON scores.user_id = users.id
                GROUP BY users.id
                ORDER BY users.id DESC
                """
            ).fetchall()
        self.json_response({"ok": True, "items": [dict(row) for row in rows]})

    def admin_stats(self):
        self.require_admin()
        with db() as conn:
            users = conn.execute("SELECT COUNT(*) AS c FROM users").fetchone()["c"]
            scores = conn.execute("SELECT COUNT(*) AS c FROM scores").fetchone()["c"]
            saves = conn.execute("SELECT COUNT(*) AS c FROM saves").fetchone()["c"]
            best = conn.execute("SELECT COALESCE(MAX(score), 0) AS c FROM scores").fetchone()["c"]
        self.json_response({"ok": True, "stats": {"users": users, "scores": scores, "saves": saves, "bestScore": best}})


if __name__ == "__main__":
    init_db()
    print(f"数学大冒险服务器已启动：http://127.0.0.1:{PORT}/")
    print("管理员后台：http://127.0.0.1:{}/admin.html".format(PORT))
    print("默认管理员：admin / admin123，请上线前修改 server.py 中的初始化密码或注册后调整数据库。")
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
