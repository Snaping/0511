from fastapi import FastAPI, Depends, HTTPException, status, Request, Response, Security
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm, APIKeyHeader
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.openapi.docs import get_swagger_ui_html, get_redoc_html
from fastapi.openapi.utils import get_openapi
from jose import JWTError, jwt
import bcrypt
from datetime import datetime, timedelta
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any, Callable
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import os
import random
import time
import threading
import uuid
import json
import secrets
from enum import Enum
from dataclasses import dataclass, field
from functools import wraps

SECRET_KEY = "your-secret-key-keep-it-safe"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
API_KEY_HEADER = APIKeyHeader(name="X-API-Key", auto_error=False)
EXCLUDED_PATHS = ["/docs", "/redoc", "/openapi.json", "/static", "/health", "/"]

fake_users_db = {
    "admin": {
        "username": "admin",
        "full_name": "Administrator",
        "email": "admin@example.com",
        "hashed_password": "$2b$12$a066rT/AxcUnIoGpitrSYONnTSHq68VGfezys4w2g72dWusmC6f..",
        "disabled": False,
    },
    "user": {
        "username": "user",
        "full_name": "Normal User",
        "email": "user@example.com",
        "hashed_password": "$2b$12$a066rT/AxcUnIoGpitrSYONnTSHq68VGfezys4w2g72dWusmC6f..",
        "disabled": False,
    }
}

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token", auto_error=False)
limiter = Limiter(key_func=get_remote_address)


@dataclass
class RequestLog:
    id: str
    timestamp: str
    method: str
    path: str
    ip: str
    user_agent: str
    status_code: int
    response_time_ms: float
    auth_type: Optional[str] = None
    user: Optional[str] = None
    api_key_id: Optional[str] = None
    error: Optional[str] = None


class RequestLogger:
    def __init__(self, max_logs: int = 1000):
        self.logs: List[RequestLog] = []
        self.max_logs = max_logs
        self._lock = threading.Lock()
        self._stats = {
            "total_requests": 0,
            "successful_requests": 0,
            "failed_requests": 0,
            "total_response_time_ms": 0,
            "methods": {},
            "status_codes": {},
            "endpoints": {},
        }

    def add_log(self, log: RequestLog):
        with self._lock:
            self.logs.append(log)
            if len(self.logs) > self.max_logs:
                self.logs.pop(0)
            
            self._stats["total_requests"] += 1
            if 200 <= log.status_code < 400:
                self._stats["successful_requests"] += 1
            else:
                self._stats["failed_requests"] += 1
            
            self._stats["total_response_time_ms"] += log.response_time_ms
            
            self._stats["methods"][log.method] = self._stats["methods"].get(log.method, 0) + 1
            self._stats["status_codes"][str(log.status_code)] = self._stats["status_codes"].get(str(log.status_code), 0) + 1
            self._stats["endpoints"][log.path] = self._stats["endpoints"].get(log.path, 0) + 1

    def get_logs(self, limit: int = 100, offset: int = 0) -> List[RequestLog]:
        with self._lock:
            return list(reversed(self.logs))[offset:offset + limit]

    def get_stats(self) -> Dict[str, Any]:
        with self._lock:
            avg_time = (self._stats["total_response_time_ms"] / self._stats["total_requests"]) if self._stats["total_requests"] > 0 else 0
            return {
                "total_requests": self._stats["total_requests"],
                "successful_requests": self._stats["successful_requests"],
                "failed_requests": self._stats["failed_requests"],
                "success_rate": (self._stats["successful_requests"] / self._stats["total_requests"] * 100) if self._stats["total_requests"] > 0 else 0,
                "average_response_time_ms": round(avg_time, 2),
                "methods_distribution": dict(self._stats["methods"]),
                "status_codes_distribution": dict(self._stats["status_codes"]),
                "top_endpoints": dict(sorted(self._stats["endpoints"].items(), key=lambda x: x[1], reverse=True)[:10]),
                "total_logs_stored": len(self.logs),
                "max_logs_capacity": self.max_logs,
            }

    def clear_logs(self):
        with self._lock:
            self.logs.clear()
            self._stats = {
                "total_requests": 0,
                "successful_requests": 0,
                "failed_requests": 0,
                "total_response_time_ms": 0,
                "methods": {},
                "status_codes": {},
                "endpoints": {},
            }


request_logger = RequestLogger()


class APIKeyStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    REVOKED = "revoked"


class APIKeyPermissions(str, Enum):
    READ = "read"
    WRITE = "write"
    ADMIN = "admin"


@dataclass
class APIKey:
    id: str
    key_hash: str
    name: str
    description: str
    owner: str
    permissions: List[APIKeyPermissions]
    status: APIKeyStatus
    created_at: str
    expires_at: Optional[str] = None
    last_used_at: Optional[str] = None
    usage_count: int = 0
    rate_limit: Optional[int] = None


class APIKeyManager:
    def __init__(self):
        self.api_keys: Dict[str, APIKey] = {}
        self._lock = threading.Lock()
        self._init_default_keys()

    def _init_default_keys(self):
        default_key = "sk_live_1234567890abcdef"
        hashed = bcrypt.hashpw(default_key.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        
        self.api_keys["key_001"] = APIKey(
            id="key_001",
            key_hash=hashed,
            name="Default API Key",
            description="Default API key for testing (sk_live_1234567890abcdef)",
            owner="admin",
            permissions=[APIKeyPermissions.READ, APIKeyPermissions.WRITE],
            status=APIKeyStatus.ACTIVE,
            created_at=datetime.utcnow().isoformat(),
            usage_count=0
        )

    def _hash_key(self, key: str) -> str:
        return bcrypt.hashpw(key.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

    def _verify_key(self, key: str, hashed: str) -> bool:
        return bcrypt.checkpw(key.encode('utf-8'), hashed.encode('utf-8'))

    def create_key(
        self,
        name: str,
        description: str,
        owner: str,
        permissions: List[APIKeyPermissions],
        expires_at: Optional[datetime] = None
    ) -> tuple[str, APIKey]:
        with self._lock:
            key_id = f"key_{secrets.token_hex(4)}"
            api_key = f"sk_live_{secrets.token_hex(16)}"
            hashed = self._hash_key(api_key)
            
            api_key_obj = APIKey(
                id=key_id,
                key_hash=hashed,
                name=name,
                description=description,
                owner=owner,
                permissions=permissions,
                status=APIKeyStatus.ACTIVE,
                created_at=datetime.utcnow().isoformat(),
                expires_at=expires_at.isoformat() if expires_at else None
            )
            
            self.api_keys[key_id] = api_key_obj
            return api_key, api_key_obj

    def verify_key(self, api_key: str) -> Optional[APIKey]:
        with self._lock:
            for key_obj in self.api_keys.values():
                if key_obj.status != APIKeyStatus.ACTIVE:
                    continue
                
                if key_obj.expires_at:
                    if datetime.fromisoformat(key_obj.expires_at) < datetime.utcnow():
                        key_obj.status = APIKeyStatus.INACTIVE
                        continue
                
                if self._verify_key(api_key, key_obj.key_hash):
                    key_obj.usage_count += 1
                    key_obj.last_used_at = datetime.utcnow().isoformat()
                    return key_obj
            return None

    def get_key(self, key_id: str) -> Optional[APIKey]:
        with self._lock:
            return self.api_keys.get(key_id)

    def list_keys(self, owner: Optional[str] = None) -> List[APIKey]:
        with self._lock:
            keys = list(self.api_keys.values())
            if owner:
                keys = [k for k in keys if k.owner == owner]
            return keys

    def revoke_key(self, key_id: str) -> bool:
        with self._lock:
            if key_id in self.api_keys:
                self.api_keys[key_id].status = APIKeyStatus.REVOKED
                return True
            return False

    def activate_key(self, key_id: str) -> bool:
        with self._lock:
            if key_id in self.api_keys:
                self.api_keys[key_id].status = APIKeyStatus.ACTIVE
                return True
            return False

    def delete_key(self, key_id: str) -> bool:
        with self._lock:
            if key_id in self.api_keys:
                del self.api_keys[key_id]
                return True
            return False

    def update_key_permissions(self, key_id: str, permissions: List[APIKeyPermissions]) -> Optional[APIKey]:
        with self._lock:
            if key_id in self.api_keys:
                self.api_keys[key_id].permissions = permissions
                return self.api_keys[key_id]
            return None


api_key_manager = APIKeyManager()


class RouteType(str, Enum):
    JSON = "json"
    HTML = "html"
    REDIRECT = "redirect"
    PROXY = "proxy"
    ECHO = "echo"
    STATIC = "static"


@dataclass
class DynamicRoute:
    id: str
    path: str
    method: str
    route_type: RouteType
    name: str
    description: str = ""
    response_data: Any = None
    response_headers: Dict[str, str] = field(default_factory=dict)
    status_code: int = 200
    redirect_url: Optional[str] = None
    proxy_target: Optional[str] = None
    html_content: Optional[str] = None
    delay_ms: int = 0
    require_auth: bool = False
    rate_limit: Optional[int] = None
    tags: List[str] = field(default_factory=list)
    created_at: str = ""
    updated_at: str = ""
    is_active: bool = True
    usage_count: int = 0


class DynamicRouteManager:
    def __init__(self):
        self.routes: Dict[str, DynamicRoute] = {}
        self._lock = threading.Lock()
        self._route_by_path: Dict[str, DynamicRoute] = {}
        self._init_default_routes()

    def _init_default_routes(self):
        now = datetime.utcnow().isoformat()
        
        self._add_route_unlocked(DynamicRoute(
            id="route_default_1",
            path="/dynamic/hello",
            method="GET",
            route_type=RouteType.JSON,
            name="Hello World",
            description="默认的 Hello World 测试路由",
            response_data={"message": "Hello from Dynamic Route!", "timestamp": now, "service": "enterprise-resilience-api"},
            created_at=now,
            updated_at=now
        ))

        self._add_route_unlocked(DynamicRoute(
            id="route_default_2",
            path="/dynamic/status",
            method="GET",
            route_type=RouteType.JSON,
            name="系统状态",
            description="简单的系统状态检查路由",
            response_data={"status": "ok", "version": "3.0.0", "dynamic_routes_enabled": True},
            created_at=now,
            updated_at=now
        ))

        self._add_route_unlocked(DynamicRoute(
            id="route_default_3",
            path="/dynamic/delay",
            method="GET",
            route_type=RouteType.JSON,
            name="延迟响应",
            description="模拟延迟的路由（2秒）",
            response_data={"message": "This response was delayed by 2 seconds"},
            delay_ms=2000,
            created_at=now,
            updated_at=now
        ))

        self._add_route_unlocked(DynamicRoute(
            id="route_default_4",
            path="/dynamic/echo",
            method="POST",
            route_type=RouteType.ECHO,
            name="Echo 服务",
            description="回显请求内容的路由",
            created_at=now,
            updated_at=now
        ))

    def _add_route_unlocked(self, route: DynamicRoute):
        self.routes[route.id] = route
        key = f"{route.method}:{route.path}"
        self._route_by_path[key] = route

    def create_route(self, route_data: Dict[str, Any]) -> DynamicRoute:
        with self._lock:
            route_id = f"route_{secrets.token_hex(6)}"
            now = datetime.utcnow().isoformat()
            
            path = route_data.get("path")
            if not path.startswith("/dynamic/"):
                path = "/dynamic/" + path.lstrip("/")
            
            route = DynamicRoute(
                id=route_id,
                path=path,
                method=route_data.get("method", "GET").upper(),
                route_type=RouteType(route_data.get("route_type", RouteType.JSON)),
                name=route_data.get("name", "Untitled Route"),
                description=route_data.get("description", ""),
                response_data=route_data.get("response_data", {}),
                response_headers=route_data.get("response_headers", {}),
                status_code=route_data.get("status_code", 200),
                redirect_url=route_data.get("redirect_url"),
                proxy_target=route_data.get("proxy_target"),
                html_content=route_data.get("html_content"),
                delay_ms=route_data.get("delay_ms", 0),
                require_auth=route_data.get("require_auth", False),
                rate_limit=route_data.get("rate_limit"),
                tags=route_data.get("tags", []),
                created_at=now,
                updated_at=now
            )
            
            self._add_route_unlocked(route)
            return route

    def update_route(self, route_id: str, update_data: Dict[str, Any]) -> Optional[DynamicRoute]:
        with self._lock:
            if route_id not in self.routes:
                return None
            
            route = self.routes[route_id]
            old_key = f"{route.method}:{route.path}"
            
            for key, value in update_data.items():
                if key == "path":
                    if not value.startswith("/dynamic/"):
                        value = "/dynamic/" + value.lstrip("/")
                    setattr(route, key, value)
                elif key == "method":
                    setattr(route, key, value.upper())
                elif key == "route_type":
                    setattr(route, key, RouteType(value))
                elif hasattr(route, key):
                    setattr(route, key, value)
            
            route.updated_at = datetime.utcnow().isoformat()
            
            new_key = f"{route.method}:{route.path}"
            if old_key != new_key:
                del self._route_by_path[old_key]
                self._route_by_path[new_key] = route
            
            return route

    def delete_route(self, route_id: str) -> bool:
        with self._lock:
            if route_id not in self.routes:
                return False
            
            route = self.routes[route_id]
            key = f"{route.method}:{route.path}"
            
            del self.routes[route_id]
            del self._route_by_path[key]
            return True

    def get_route(self, route_id: str) -> Optional[DynamicRoute]:
        with self._lock:
            return self.routes.get(route_id)

    def get_route_by_path(self, method: str, path: str) -> Optional[DynamicRoute]:
        with self._lock:
            key = f"{method.upper()}:{path}"
            return self._route_by_path.get(key)

    def list_routes(self) -> List[DynamicRoute]:
        with self._lock:
            return list(self.routes.values())

    def increment_usage(self, route_id: str):
        with self._lock:
            if route_id in self.routes:
                self.routes[route_id].usage_count += 1

    def toggle_route(self, route_id: str, is_active: bool) -> Optional[DynamicRoute]:
        with self._lock:
            if route_id not in self.routes:
                return None
            
            self.routes[route_id].is_active = is_active
            self.routes[route_id].updated_at = datetime.utcnow().isoformat()
            return self.routes[route_id]


dynamic_route_manager = DynamicRouteManager()


class CircuitState(str, Enum):
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"


@dataclass
class CircuitBreakerConfig:
    failure_threshold: int = 5
    recovery_timeout: int = 10
    success_threshold: int = 3


@dataclass
class CircuitBreaker:
    name: str
    config: CircuitBreakerConfig = field(default_factory=CircuitBreakerConfig)
    state: CircuitState = CircuitState.CLOSED
    failure_count: int = 0
    success_count: int = 0
    last_failure_time: float = 0
    _lock: threading.Lock = field(default_factory=threading.Lock)

    def can_execute(self) -> bool:
        with self._lock:
            if self.state == CircuitState.OPEN:
                if time.time() - self.last_failure_time > self.config.recovery_timeout:
                    self.state = CircuitState.HALF_OPEN
                    self.success_count = 0
                    return True
                return False
            return True

    def on_success(self):
        with self._lock:
            if self.state == CircuitState.HALF_OPEN:
                self.success_count += 1
                if self.success_count >= self.config.success_threshold:
                    self.state = CircuitState.CLOSED
                    self.failure_count = 0
                    self.success_count = 0
            else:
                self.failure_count = 0

    def on_failure(self):
        with self._lock:
            self.failure_count += 1
            self.last_failure_time = time.time()
            if self.state == CircuitState.CLOSED and self.failure_count >= self.config.failure_threshold:
                self.state = CircuitState.OPEN
            elif self.state == CircuitState.HALF_OPEN:
                self.state = CircuitState.OPEN
                self.success_count = 0

    def get_status(self) -> Dict[str, Any]:
        with self._lock:
            return {
                "name": self.name,
                "state": self.state.value,
                "failure_count": self.failure_count,
                "success_count": self.success_count,
                "last_failure_time": self.last_failure_time,
                "config": {
                    "failure_threshold": self.config.failure_threshold,
                    "recovery_timeout": self.config.recovery_timeout,
                    "success_threshold": self.config.success_threshold,
                }
            }


class LoadBalancingStrategy(str, Enum):
    ROUND_ROBIN = "round_robin"
    RANDOM = "random"
    LEAST_CONNECTIONS = "least_connections"
    WEIGHTED_ROUND_ROBIN = "weighted_round_robin"


@dataclass
class BackendServer:
    id: str
    name: str
    base_url: str
    weight: int = 1
    is_healthy: bool = True
    active_connections: int = 0
    total_requests: int = 0
    total_failures: int = 0
    _lock: threading.Lock = field(default_factory=threading.Lock)

    def increment_connections(self):
        with self._lock:
            self.active_connections += 1

    def decrement_connections(self):
        with self._lock:
            self.active_connections = max(0, self.active_connections - 1)

    def increment_requests(self, success: bool = True):
        with self._lock:
            self.total_requests += 1
            if not success:
                self.total_failures += 1

    def get_stats(self) -> Dict[str, Any]:
        with self._lock:
            return {
                "id": self.id,
                "name": self.name,
                "base_url": self.base_url,
                "weight": self.weight,
                "is_healthy": self.is_healthy,
                "active_connections": self.active_connections,
                "total_requests": self.total_requests,
                "total_failures": self.total_failures,
            }


class LoadBalancer:
    def __init__(self, strategy: LoadBalancingStrategy = LoadBalancingStrategy.ROUND_ROBIN):
        self.servers: List[BackendServer] = []
        self.strategy = strategy
        self._round_robin_index: int = 0
        self._weighted_index: int = 0
        self._current_weight: int = 0
        self._lock: threading.Lock = threading.Lock()

    def add_server(self, server: BackendServer):
        self.servers.append(server)

    def remove_server(self, server_id: str):
        self.servers = [s for s in self.servers if s.id != server_id]

    def get_healthy_servers(self) -> List[BackendServer]:
        return [s for s in self.servers if s.is_healthy]

    def _round_robin(self, servers: List[BackendServer]) -> Optional[BackendServer]:
        if not servers:
            return None
        with self._lock:
            server = servers[self._round_robin_index % len(servers)]
            self._round_robin_index += 1
            return server

    def _random(self, servers: List[BackendServer]) -> Optional[BackendServer]:
        if not servers:
            return None
        return random.choice(servers)

    def _least_connections(self, servers: List[BackendServer]) -> Optional[BackendServer]:
        if not servers:
            return None
        return min(servers, key=lambda s: s.active_connections)

    def _weighted_round_robin(self, servers: List[BackendServer]) -> Optional[BackendServer]:
        if not servers:
            return None
        
        total_weight = sum(s.weight for s in servers)
        if total_weight == 0:
            return self._round_robin(servers)
        
        with self._lock:
            while True:
                self._weighted_index = (self._weighted_index + 1) % len(servers)
                if self._weighted_index == 0:
                    self._current_weight = max(self._current_weight - 1, 0)
                    if self._current_weight <= 0:
                        self._current_weight = max(s.weight for s in servers)
                
                if servers[self._weighted_index].weight >= self._current_weight:
                    return servers[self._weighted_index]

    def select_server(self) -> Optional[BackendServer]:
        healthy_servers = self.get_healthy_servers()
        
        if self.strategy == LoadBalancingStrategy.ROUND_ROBIN:
            return self._round_robin(healthy_servers)
        elif self.strategy == LoadBalancingStrategy.RANDOM:
            return self._random(healthy_servers)
        elif self.strategy == LoadBalancingStrategy.LEAST_CONNECTIONS:
            return self._least_connections(healthy_servers)
        elif self.strategy == LoadBalancingStrategy.WEIGHTED_ROUND_ROBIN:
            return self._weighted_round_robin(healthy_servers)
        
        return self._round_robin(healthy_servers)

    def set_strategy(self, strategy: LoadBalancingStrategy):
        self.strategy = strategy

    def get_stats(self) -> Dict[str, Any]:
        return {
            "strategy": self.strategy.value,
            "total_servers": len(self.servers),
            "healthy_servers": len(self.get_healthy_servers()),
            "servers": [s.get_stats() for s in self.servers],
        }


circuit_breakers: Dict[str, CircuitBreaker] = {}
load_balancer = LoadBalancer(LoadBalancingStrategy.ROUND_ROBIN)

def init_mock_servers():
    servers = [
        BackendServer(id="server-1", name="Primary Server", base_url="http://localhost:8001", weight=3),
        BackendServer(id="server-2", name="Secondary Server", base_url="http://localhost:8002", weight=2),
        BackendServer(id="server-3", name="Tertiary Server", base_url="http://localhost:8003", weight=1),
    ]
    for server in servers:
        load_balancer.add_server(server)

def get_or_create_circuit_breaker(name: str, config: Optional[CircuitBreakerConfig] = None) -> CircuitBreaker:
    if name not in circuit_breakers:
        circuit_breakers[name] = CircuitBreaker(name=name, config=config or CircuitBreakerConfig())
    return circuit_breakers[name]

init_mock_servers()


class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

class User(BaseModel):
    username: str
    email: Optional[str] = None
    full_name: Optional[str] = None
    disabled: Optional[bool] = None

class UserInDB(User):
    hashed_password: str

class Item(BaseModel):
    name: str
    price: float
    description: Optional[str] = None

class CircuitBreakerStatus(BaseModel):
    name: str
    state: str
    failure_count: int
    success_count: int
    config: Dict[str, Any]

class LoadBalancerStatus(BaseModel):
    strategy: str
    total_servers: int
    healthy_servers: int
    servers: List[Dict[str, Any]]

class LoadBalanceRequest(BaseModel):
    simulate_failure: bool = False
    simulate_delay: float = 0.0

class CreateAPIKeyRequest(BaseModel):
    name: str = Field(..., description="API Key 名称")
    description: str = Field("", description="API Key 描述")
    permissions: List[APIKeyPermissions] = Field(default_factory=lambda: [APIKeyPermissions.READ], description="权限列表")
    expires_days: Optional[int] = Field(None, description="过期天数（None表示永不过期）")

class APIKeyResponse(BaseModel):
    id: str
    name: str
    description: str
    owner: str
    permissions: List[str]
    status: str
    created_at: str
    expires_at: Optional[str]
    last_used_at: Optional[str]
    usage_count: int

class RequestLogResponse(BaseModel):
    id: str
    timestamp: str
    method: str
    path: str
    ip: str
    user_agent: str
    status_code: int
    response_time_ms: float
    auth_type: Optional[str]
    user: Optional[str]


class CreateDynamicRouteRequest(BaseModel):
    path: str = Field(..., description="路由路径，将自动以 /dynamic/ 开头")
    method: str = Field("GET", description="HTTP 方法: GET, POST, PUT, DELETE, PATCH")
    route_type: str = Field("json", description="路由类型: json, html, redirect, proxy, echo, static")
    name: str = Field(..., description="路由名称")
    description: str = Field("", description="路由描述")
    response_data: Optional[Dict[str, Any]] = Field(default=None, description="JSON 响应数据")
    response_headers: Optional[Dict[str, str]] = Field(default_factory=dict, description="自定义响应头")
    status_code: int = Field(200, description="响应状态码")
    redirect_url: Optional[str] = Field(None, description="重定向目标 URL（仅 redirect 类型）")
    proxy_target: Optional[str] = Field(None, description="代理目标 URL（仅 proxy 类型）")
    html_content: Optional[str] = Field(None, description="HTML 内容（仅 html 类型）")
    delay_ms: int = Field(0, description="响应延迟（毫秒）")
    require_auth: bool = Field(False, description="是否需要认证")
    tags: List[str] = Field(default_factory=list, description="标签列表")


class UpdateDynamicRouteRequest(BaseModel):
    path: Optional[str] = Field(None, description="路由路径")
    method: Optional[str] = Field(None, description="HTTP 方法")
    route_type: Optional[str] = Field(None, description="路由类型")
    name: Optional[str] = Field(None, description="路由名称")
    description: Optional[str] = Field(None, description="路由描述")
    response_data: Optional[Dict[str, Any]] = Field(None, description="JSON 响应数据")
    response_headers: Optional[Dict[str, str]] = Field(None, description="自定义响应头")
    status_code: Optional[int] = Field(None, description="响应状态码")
    redirect_url: Optional[str] = Field(None, description="重定向目标 URL")
    proxy_target: Optional[str] = Field(None, description="代理目标 URL")
    html_content: Optional[str] = Field(None, description="HTML 内容")
    delay_ms: Optional[int] = Field(None, description="响应延迟（毫秒）")
    require_auth: Optional[bool] = Field(None, description="是否需要认证")
    tags: Optional[List[str]] = Field(None, description="标签列表")


class DynamicRouteResponse(BaseModel):
    id: str
    path: str
    method: str
    route_type: str
    name: str
    description: str
    response_data: Optional[Dict[str, Any]]
    status_code: int
    redirect_url: Optional[str]
    proxy_target: Optional[str]
    delay_ms: int
    require_auth: bool
    is_active: bool
    usage_count: int
    tags: List[str]
    created_at: str
    updated_at: str


def verify_password(plain_password, hashed_password):
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

def get_password_hash(password):
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def get_user(db, username: str):
    if username in db:
        user_dict = db[username]
        return UserInDB(**user_dict)

def authenticate_user(fake_db, username: str, password: str):
    user = get_user(fake_db, username)
    if not user:
        return False
    if not verify_password(password, user.hashed_password):
        return False
    return user

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(token: Optional[str] = Depends(oauth2_scheme)):
    if not token:
        return None
    
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        token_data = TokenData(username=username)
    except JWTError:
        raise credentials_exception
    user = get_user(fake_users_db, username=token_data.username)
    if user is None:
        raise credentials_exception
    return user

async def get_current_active_user(current_user: User = Depends(get_current_user)):
    if current_user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if current_user.disabled:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user

async def get_api_key(api_key_header: Optional[str] = Security(API_KEY_HEADER)):
    if api_key_header is None:
        return None
    return api_key_manager.verify_key(api_key_header)

async def get_any_authentication(
    current_user: Optional[User] = Depends(get_current_user),
    api_key: Optional[APIKey] = Depends(get_api_key)
) -> Dict[str, Any]:
    if current_user:
        return {"type": "jwt", "user": current_user, "permissions": ["read", "write", "admin"]}
    if api_key:
        return {"type": "api_key", "user": api_key.owner, "api_key": api_key, "permissions": [p.value for p in api_key.permissions]}
    return {"type": "none", "user": None, "permissions": []}

async def require_authentication(
    auth: Dict[str, Any] = Depends(get_any_authentication)
) -> Dict[str, Any]:
    if auth["type"] == "none":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required: use JWT or API Key",
            headers={"WWW-Authenticate": "Bearer, X-API-Key"},
        )
    return auth


app = FastAPI(
    title="Enterprise Resilience API Platform",
    version="3.0.0",
    description="""
    # Enterprise Resilience API Platform
    
    企业级弹性 API 平台，提供完整的微服务弹性能力。
    
    ## 特性
    
    - **JWT 认证**: 基于 OAuth2 的 JSON Web Token 认证
    - **API Key 管理**: 支持 API Key 生成、撤销、权限管理
    - **接口限流**: 基于 slowapi 的灵活限流策略
    - **熔断器**: 防止级联故障的 Circuit Breaker 模式
    - **负载均衡**: 多种负载均衡策略（轮询、随机、最少连接、加权轮询）
    - **请求日志**: 完整的请求追踪和性能统计
    - **动态路由**: 支持运行时创建、修改、删除路由，多种响应类型
    
    ## 认证方式
    
    本 API 支持两种认证方式：
    
    1. **JWT Token**: 通过 `/token` 端点获取
    2. **API Key**: 通过 `X-API-Key` 请求头传递
       - 默认测试 Key: `sk_live_1234567890abcdef`
    """,
    openapi_tags=[
        {
            "name": "认证",
            "description": "用户登录、Token 获取等认证相关接口"
        },
        {
            "name": "用户",
            "description": "用户信息管理"
        },
        {
            "name": "API Key 管理",
            "description": "API Key 的创建、列表、撤销等管理接口"
        },
        {
            "name": "熔断器",
            "description": "熔断器模式测试和管理接口"
        },
        {
            "name": "负载均衡",
            "description": "负载均衡策略和服务器管理接口"
        },
        {
            "name": "请求日志",
            "description": "请求日志查询和统计接口"
        },
        {
            "name": "动态路由",
            "description": "运行时动态创建、管理路由的接口"
        },
        {
            "name": "公开接口",
            "description": "无需认证的公开接口"
        },
        {
            "name": "仪表盘",
            "description": "系统状态总览仪表盘"
        }
    ]
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


async def _execute_dynamic_route(request: Request, route: DynamicRoute) -> Response:
    """
    执行动态路由的核心引擎，支持多种响应类型
    """
    if route.delay_ms > 0:
        time.sleep(route.delay_ms / 1000.0)
    
    dynamic_route_manager.increment_usage(route.id)
    
    headers = dict(route.response_headers)
    headers["X-Dynamic-Route"] = route.id
    
    if route.route_type == RouteType.JSON:
        response_data = route.response_data or {}
        if isinstance(response_data, dict):
            response_data["_meta"] = {
                "route_id": route.id,
                "route_name": route.name,
                "timestamp": datetime.utcnow().isoformat()
            }
        return JSONResponse(
            content=response_data,
            status_code=route.status_code,
            headers=headers
        )
    
    elif route.route_type == RouteType.HTML:
        html_content = route.html_content or """
        <!DOCTYPE html>
        <html>
        <head><title>Dynamic Route</title></head>
        <body><h1>Dynamic Route Response</h1></body>
        </html>
        """
        return Response(
            content=html_content,
            status_code=route.status_code,
            media_type="text/html",
            headers=headers
        )
    
    elif route.route_type == RouteType.REDIRECT:
        from fastapi.responses import RedirectResponse
        redirect_url = route.redirect_url or "/"
        return RedirectResponse(
            url=redirect_url,
            status_code=route.status_code if 300 <= route.status_code < 400 else 302,
            headers=headers
        )
    
    elif route.route_type == RouteType.ECHO:
        try:
            body = await request.json()
        except:
            body = None
        
        echo_data = {
            "method": request.method,
            "path": request.url.path,
            "headers": dict(request.headers),
            "query_params": dict(request.query_params),
            "body": body,
            "client": {
                "host": request.client.host if request.client else None,
                "port": request.client.port if request.client else None
            },
            "route_info": {
                "id": route.id,
                "name": route.name,
                "type": route.route_type.value
            }
        }
        return JSONResponse(
            content=echo_data,
            status_code=route.status_code,
            headers=headers
        )
    
    elif route.route_type == RouteType.STATIC:
        static_data = {
            "message": f"Static response from route: {route.name}",
            "route_id": route.id,
            "description": route.description,
            "created_at": route.created_at,
            "timestamp": datetime.utcnow().isoformat()
        }
        return JSONResponse(
            content=static_data,
            status_code=route.status_code,
            headers=headers
        )
    
    elif route.route_type == RouteType.PROXY:
        try:
            import urllib.request
            import urllib.error
            
            target_url = route.proxy_target
            if not target_url:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Proxy target URL not configured"
                )
            
            if request.query_params:
                query_string = "&".join([f"{k}={v}" for k, v in request.query_params.items()])
                if "?" in target_url:
                    target_url += "&" + query_string
                else:
                    target_url += "?" + query_string
            
            req = urllib.request.Request(target_url, method=request.method)
            
            for key, value in request.headers.items():
                if key.lower() not in ["host", "content-length", "connection"]:
                    req.add_header(key, value)
            
            try:
                response = urllib.request.urlopen(req, timeout=30)
                content = response.read().decode("utf-8", errors="replace")
                return Response(
                    content=content,
                    status_code=response.status,
                    headers=headers
                )
            except urllib.error.HTTPError as e:
                return Response(
                    content=e.read().decode("utf-8", errors="replace"),
                    status_code=e.code,
                    headers=headers
                )
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Proxy error: {str(e)}"
            )
    
    return JSONResponse(
        content={"error": "Unknown route type"},
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
    )


@app.middleware("http")
async def dynamic_route_middleware(request: Request, call_next):
    """
    动态路由执行中间件 - 在静态路由之前检查是否有匹配的动态路由
    """
    path = request.url.path
    
    if path.startswith("/dynamic/"):
        route = dynamic_route_manager.get_route_by_path(request.method, path)
        
        if route and route.is_active:
            if route.require_auth:
                auth_header = request.headers.get("Authorization")
                api_key_header = request.headers.get("X-API-Key")
                
                is_authenticated = False
                if auth_header and auth_header.startswith("Bearer "):
                    try:
                        token = auth_header.replace("Bearer ", "")
                        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
                        is_authenticated = True
                    except:
                        pass
                elif api_key_header:
                    api_key = api_key_manager.verify_key(api_key_header)
                    if api_key:
                        is_authenticated = True
                
                if not is_authenticated:
                    return JSONResponse(
                        content={"detail": "Not authenticated"},
                        status_code=status.HTTP_401_UNAUTHORIZED
                    )
            
            return await _execute_dynamic_route(request, route)
    
    return await call_next(request)


@app.middleware("http")
async def request_logging_middleware(request: Request, call_next):
    start_time = time.time()
    request_id = str(uuid.uuid4())
    
    response = await call_next(request)
    
    response_time_ms = (time.time() - start_time) * 1000
    
    if not any(request.url.path.startswith(excluded) for excluded in EXCLUDED_PATHS):
        auth_type = None
        user = None
        api_key_id = None
        
        auth_header = request.headers.get("Authorization")
        api_key_header = request.headers.get("X-API-Key")
        
        if auth_header and auth_header.startswith("Bearer "):
            auth_type = "jwt"
            token = auth_header.replace("Bearer ", "")
            try:
                payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
                user = payload.get("sub")
            except:
                pass
        elif api_key_header:
            auth_type = "api_key"
        
        log = RequestLog(
            id=request_id,
            timestamp=datetime.utcnow().isoformat(),
            method=request.method,
            path=request.url.path,
            ip=request.client.host if request.client else "unknown",
            user_agent=request.headers.get("user-agent", "unknown"),
            status_code=response.status_code,
            response_time_ms=round(response_time_ms, 2),
            auth_type=auth_type,
            user=user
        )
        request_logger.add_log(log)
    
    return response


def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    
    openapi_schema = get_openapi(
        title=app.title,
        version=app.version,
        description=app.description,
        routes=app.routes,
        tags=app.openapi_tags,
    )
    
    openapi_schema["components"]["securitySchemes"] = {
        "bearerAuth": {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT",
            "description": "通过 /token 端点获取 JWT Token"
        },
        "apiKeyAuth": {
            "type": "apiKey",
            "in": "header",
            "name": "X-API-Key",
            "description": "API Key 认证（默认测试 Key: sk_live_1234567890abcdef）"
        }
    }
    
    openapi_schema["security"] = [
        {"bearerAuth": []},
        {"apiKeyAuth": []}
    ]
    
    openapi_schema["info"]["x-logo"] = {
        "url": "https://fastapi.tiangolo.com/img/logo-margin/logo-teal.png"
    }
    
    openapi_schema["info"]["contact"] = {
        "name": "API Support",
        "email": "support@example.com"
    }
    
    openapi_schema["info"]["license"] = {
        "name": "MIT",
        "url": "https://opensource.org/licenses/MIT"
    }
    
    openapi_schema["x-tagGroups"] = [
        {
            "name": "核心功能",
            "tags": ["认证", "用户", "API Key 管理"]
        },
        {
            "name": "弹性能力",
            "tags": ["熔断器", "负载均衡"]
        },
        {
            "name": "可观测性",
            "tags": ["请求日志", "仪表盘"]
        },
        {
            "name": "其他",
            "tags": ["公开接口"]
        }
    ]
    
    app.openapi_schema = openapi_schema
    return app.openapi_schema

app.openapi = custom_openapi


@app.get("/docs", include_in_schema=False)
async def custom_swagger_ui_html():
    return get_swagger_ui_html(
        openapi_url="/openapi.json",
        title=app.title + " - Swagger UI",
        oauth2_redirect_url="/docs/oauth2-redirect",
        swagger_js_url="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js",
        swagger_css_url="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css",
        swagger_favicon_url="https://fastapi.tiangolo.com/img/favicon.png"
    )

@app.get("/redoc", include_in_schema=False)
async def custom_redoc_html():
    return get_redoc_html(
        openapi_url="/openapi.json",
        title=app.title + " - ReDoc",
        redoc_js_url="https://cdn.jsdelivr.net/npm/redoc@next/bundles/redoc.standalone.js",
    )


@app.post("/token", response_model=Token, tags=["认证"], summary="获取访问令牌", description="使用用户名和密码获取 JWT 访问令牌")
@limiter.limit("5/minute")
async def login_for_access_token(request: Request, form_data: OAuth2PasswordRequestForm = Depends()):
    """
    使用用户名和密码进行身份验证，并获取 JWT 访问令牌。
    
    - **username**: 用户名（admin 或 user）
    - **password**: 密码（password）
    """
    user = authenticate_user(fake_users_db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}


@app.get("/users/me/", response_model=User, tags=["用户"], summary="获取当前用户信息")
@limiter.limit("10/minute")
async def read_users_me(request: Request, current_user: User = Depends(get_current_active_user)):
    return current_user


@app.get("/users/me/items/", tags=["用户"], summary="获取当前用户的商品")
@limiter.limit("10/minute")
async def read_own_items(request: Request, current_user: User = Depends(get_current_active_user)):
    return [{"item_id": "1", "owner": current_user.username}]


@app.get("/public/items/", tags=["公开接口"], summary="获取公开商品列表")
@limiter.limit("20/minute")
async def read_public_items(request: Request):
    return [
        {"item_id": "1", "name": "Public Item 1", "price": 10.99},
        {"item_id": "2", "name": "Public Item 2", "price": 20.99},
        {"item_id": "3", "name": "Public Item 3", "price": 30.99}
    ]


@app.post("/items/", response_model=Item, tags=["用户"], summary="创建商品")
@limiter.limit("5/minute")
async def create_item(item: Item, request: Request, auth: Dict[str, Any] = Depends(require_authentication)):
    return item


@app.get("/health", tags=["公开接口"], summary="健康检查")
@limiter.limit("60/minute")
async def health_check(request: Request):
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}


@app.post("/circuit-breaker/test/{service_name}", tags=["熔断器"], summary="测试熔断器")
@limiter.limit("30/minute")
async def test_circuit_breaker(
    service_name: str,
    request: Request,
    should_fail: bool = False,
    delay: float = 0.0,
    auth: Dict[str, Any] = Depends(require_authentication)
):
    """
    测试熔断器功能。
    
    - **service_name**: 服务名称
    - **should_fail**: 是否模拟失败
    - **delay**: 模拟延迟（秒）
    """
    cb = get_or_create_circuit_breaker(service_name)
    
    if not cb.can_execute():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Circuit breaker for '{service_name}' is OPEN. Service unavailable.",
            headers={"Retry-After": str(cb.config.recovery_timeout)}
        )
    
    try:
        if delay > 0:
            time.sleep(delay)
        
        if should_fail:
            raise Exception(f"Simulated failure in {service_name}")
        
        cb.on_success()
        return {
            "service": service_name,
            "status": "success",
            "processed_at": datetime.utcnow().isoformat(),
            "circuit_breaker": cb.get_status()
        }
    except Exception as e:
        cb.on_failure()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.get("/circuit-breaker/status/", tags=["熔断器"], summary="获取所有熔断器状态")
@limiter.limit("60/minute")
async def get_all_circuit_breaker_status(request: Request, auth: Dict[str, Any] = Depends(require_authentication)):
    return {
        "circuit_breakers": [cb.get_status() for cb in circuit_breakers.values()],
        "total": len(circuit_breakers)
    }


@app.get("/circuit-breaker/status/{service_name}", tags=["熔断器"], summary="获取指定熔断器状态")
@limiter.limit("60/minute")
async def get_circuit_breaker_status(service_name: str, request: Request, auth: Dict[str, Any] = Depends(require_authentication)):
    if service_name not in circuit_breakers:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Circuit breaker '{service_name}' not found"
        )
    return circuit_breakers[service_name].get_status()


@app.post("/circuit-breaker/reset/{service_name}", tags=["熔断器"], summary="重置熔断器")
@limiter.limit("10/minute")
async def reset_circuit_breaker(service_name: str, request: Request, auth: Dict[str, Any] = Depends(require_authentication)):
    if service_name not in circuit_breakers:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Circuit breaker '{service_name}' not found"
        )
    
    cb = circuit_breakers[service_name]
    with cb._lock:
        cb.state = CircuitState.CLOSED
        cb.failure_count = 0
        cb.success_count = 0
    
    return {
        "message": f"Circuit breaker '{service_name}' has been reset",
        "circuit_breaker": cb.get_status()
    }


@app.post("/circuit-breaker/config/{service_name}", tags=["熔断器"], summary="配置熔断器")
@limiter.limit("10/minute")
async def configure_circuit_breaker(
    service_name: str,
    request: Request,
    failure_threshold: int = 5,
    recovery_timeout: int = 10,
    success_threshold: int = 3,
    auth: Dict[str, Any] = Depends(require_authentication)
):
    cb = get_or_create_circuit_breaker(
        service_name,
        CircuitBreakerConfig(
            failure_threshold=failure_threshold,
            recovery_timeout=recovery_timeout,
            success_threshold=success_threshold
        )
    )
    
    with cb._lock:
        cb.config.failure_threshold = failure_threshold
        cb.config.recovery_timeout = recovery_timeout
        cb.config.success_threshold = success_threshold
    
    return {
        "message": f"Circuit breaker '{service_name}' configured",
        "circuit_breaker": cb.get_status()
    }


@app.get("/load-balancer/status/", tags=["负载均衡"], summary="获取负载均衡器状态")
@limiter.limit("60/minute")
async def get_load_balancer_status(request: Request, auth: Dict[str, Any] = Depends(require_authentication)):
    return load_balancer.get_stats()


@app.post("/load-balancer/strategy/{strategy}", tags=["负载均衡"], summary="切换负载均衡策略")
@limiter.limit("10/minute")
async def set_load_balancer_strategy(strategy: LoadBalancingStrategy, request: Request, auth: Dict[str, Any] = Depends(require_authentication)):
    load_balancer.set_strategy(strategy)
    return {
        "message": f"Load balancing strategy changed to {strategy.value}",
        "load_balancer": load_balancer.get_stats()
    }


@app.post("/load-balancer/select/", tags=["负载均衡"], summary="选择服务器")
@limiter.limit("30/minute")
async def select_server_via_load_balancer(request: Request, auth: Dict[str, Any] = Depends(require_authentication)):
    server = load_balancer.select_server()
    if not server:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="No healthy servers available"
        )
    
    server.increment_requests(success=True)
    return {
        "selected_server": server.get_stats(),
        "strategy": load_balancer.strategy.value,
        "timestamp": datetime.utcnow().isoformat()
    }


@app.post("/load-balancer/test/", tags=["负载均衡"], summary="批量测试负载均衡")
@limiter.limit("30/minute")
async def test_load_balancer(
    requests_count: int = 10,
    request: Request = None,
    auth: Dict[str, Any] = Depends(require_authentication)
):
    if requests_count < 1 or requests_count > 100:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="requests_count must be between 1 and 100"
        )
    
    results = []
    distribution = {}
    
    for i in range(requests_count):
        server = load_balancer.select_server()
        if server:
            server.increment_requests(success=True)
            server_name = server.name
            results.append({
                "request": i + 1,
                "server_id": server.id,
                "server_name": server_name,
            })
            distribution[server_name] = distribution.get(server_name, 0) + 1
    
    return {
        "total_requests": requests_count,
        "strategy": load_balancer.strategy.value,
        "distribution": distribution,
        "load_balancer": load_balancer.get_stats(),
        "results": results
    }


@app.post("/load-balancer/server/{server_id}/toggle", tags=["负载均衡"], summary="切换服务器健康状态")
@limiter.limit("10/minute")
async def toggle_server_health(server_id: str, request: Request, auth: Dict[str, Any] = Depends(require_authentication)):
    server = next((s for s in load_balancer.servers if s.id == server_id), None)
    if not server:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Server '{server_id}' not found"
        )
    
    with server._lock:
        server.is_healthy = not server.is_healthy
    
    return {
        "message": f"Server '{server.name}' health status toggled",
        "server": server.get_stats(),
        "load_balancer": load_balancer.get_stats()
    }


@app.post("/load-balancer/server/{server_id}/weight", tags=["负载均衡"], summary="设置服务器权重")
@limiter.limit("10/minute")
async def set_server_weight(
    server_id: str,
    weight: int,
    request: Request,
    auth: Dict[str, Any] = Depends(require_authentication)
):
    if weight < 1 or weight > 10:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Weight must be between 1 and 10"
        )
    
    server = next((s for s in load_balancer.servers if s.id == server_id), None)
    if not server:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Server '{server_id}' not found"
        )
    
    with server._lock:
        server.weight = weight
    
    return {
        "message": f"Server '{server.name}' weight updated to {weight}",
        "server": server.get_stats(),
        "load_balancer": load_balancer.get_stats()
    }


@app.post("/load-balancer/reset/", tags=["负载均衡"], summary="重置负载均衡统计")
@limiter.limit("10/minute")
async def reset_load_balancer_stats(request: Request, auth: Dict[str, Any] = Depends(require_authentication)):
    for server in load_balancer.servers:
        with server._lock:
            server.total_requests = 0
            server.total_failures = 0
            server.active_connections = 0
    
    load_balancer._round_robin_index = 0
    load_balancer._weighted_index = 0
    load_balancer._current_weight = 0
    
    return {
        "message": "Load balancer statistics reset",
        "load_balancer": load_balancer.get_stats()
    }


@app.post("/api-keys/", tags=["API Key 管理"], summary="创建新的 API Key")
@limiter.limit("10/minute")
async def create_api_key(
    request_data: CreateAPIKeyRequest,
    request: Request,
    current_user: User = Depends(get_current_active_user)
):
    """
    创建新的 API Key。
    
    - **name**: API Key 名称
    - **description**: API Key 描述
    - **permissions**: 权限列表 (read, write, admin)
    - **expires_days**: 过期天数（None 表示永不过期）
    """
    expires_at = None
    if request_data.expires_days:
        expires_at = datetime.utcnow() + timedelta(days=request_data.expires_days)
    
    api_key, api_key_obj = api_key_manager.create_key(
        name=request_data.name,
        description=request_data.description,
        owner=current_user.username,
        permissions=request_data.permissions,
        expires_at=expires_at
    )
    
    return {
        "message": "API Key created successfully",
        "api_key": api_key,
        "details": {
            "id": api_key_obj.id,
            "name": api_key_obj.name,
            "description": api_key_obj.description,
            "permissions": [p.value for p in api_key_obj.permissions],
            "status": api_key_obj.status.value,
            "created_at": api_key_obj.created_at,
            "expires_at": api_key_obj.expires_at
        }
    }


@app.get("/api-keys/", tags=["API Key 管理"], summary="获取 API Key 列表")
@limiter.limit("60/minute")
async def list_api_keys(request: Request, current_user: User = Depends(get_current_active_user)):
    keys = api_key_manager.list_keys()
    
    return {
        "total": len(keys),
        "api_keys": [
            {
                "id": k.id,
                "name": k.name,
                "description": k.description,
                "owner": k.owner,
                "permissions": [p.value for p in k.permissions],
                "status": k.status.value,
                "created_at": k.created_at,
                "expires_at": k.expires_at,
                "last_used_at": k.last_used_at,
                "usage_count": k.usage_count,
                "key_preview": "***" + k.key_hash[-8:] if len(k.key_hash) > 8 else "***"
            }
            for k in keys
        ]
    }


@app.get("/api-keys/{key_id}", tags=["API Key 管理"], summary="获取指定 API Key 详情")
@limiter.limit("60/minute")
async def get_api_key_details(key_id: str, request: Request, current_user: User = Depends(get_current_active_user)):
    key = api_key_manager.get_key(key_id)
    if not key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"API Key '{key_id}' not found"
        )
    
    return {
        "id": key.id,
        "name": key.name,
        "description": key.description,
        "owner": key.owner,
        "permissions": [p.value for p in key.permissions],
        "status": key.status.value,
        "created_at": key.created_at,
        "expires_at": key.expires_at,
        "last_used_at": key.last_used_at,
        "usage_count": key.usage_count
    }


@app.post("/api-keys/{key_id}/revoke", tags=["API Key 管理"], summary="撤销 API Key")
@limiter.limit("10/minute")
async def revoke_api_key(key_id: str, request: Request, current_user: User = Depends(get_current_active_user)):
    if not api_key_manager.revoke_key(key_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"API Key '{key_id}' not found"
        )
    
    return {"message": f"API Key '{key_id}' has been revoked"}


@app.post("/api-keys/{key_id}/activate", tags=["API Key 管理"], summary="激活 API Key")
@limiter.limit("10/minute")
async def activate_api_key(key_id: str, request: Request, current_user: User = Depends(get_current_active_user)):
    if not api_key_manager.activate_key(key_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"API Key '{key_id}' not found"
        )
    
    return {"message": f"API Key '{key_id}' has been activated"}


@app.delete("/api-keys/{key_id}", tags=["API Key 管理"], summary="删除 API Key")
@limiter.limit("10/minute")
async def delete_api_key(key_id: str, request: Request, current_user: User = Depends(get_current_active_user)):
    if not api_key_manager.delete_key(key_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"API Key '{key_id}' not found"
        )
    
    return {"message": f"API Key '{key_id}' has been deleted"}


@app.get("/api-keys/verify/test", tags=["API Key 管理"], summary="测试 API Key 认证")
@limiter.limit("60/minute")
async def test_api_key_auth(request: Request, api_key: Optional[APIKey] = Depends(get_api_key)):
    """
    使用 X-API-Key 头进行认证测试。
    """
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing API Key"
        )
    
    return {
        "message": "API Key authentication successful",
        "api_key": {
            "id": api_key.id,
            "name": api_key.name,
            "owner": api_key.owner,
            "permissions": [p.value for p in api_key.permissions]
        }
    }


@app.get("/logs/", tags=["请求日志"], summary="获取请求日志")
@limiter.limit("60/minute")
async def get_request_logs(
    limit: int = 50,
    offset: int = 0,
    request: Request = None,
    auth: Dict[str, Any] = Depends(require_authentication)
):
    """
    获取请求日志列表。
    
    - **limit**: 返回日志数量（最大100）
    - **offset**: 偏移量
    """
    if limit > 100:
        limit = 100
    
    logs = request_logger.get_logs(limit=limit, offset=offset)
    
    return {
        "total_available": len(request_logger.logs),
        "returned": len(logs),
        "limit": limit,
        "offset": offset,
        "logs": [
            {
                "id": log.id,
                "timestamp": log.timestamp,
                "method": log.method,
                "path": log.path,
                "ip": log.ip,
                "user_agent": log.user_agent,
                "status_code": log.status_code,
                "response_time_ms": log.response_time_ms,
                "auth_type": log.auth_type,
                "user": log.user,
                "error": log.error
            }
            for log in logs
        ]
    }


@app.get("/logs/stats/", tags=["请求日志"], summary="获取请求统计")
@limiter.limit("60/minute")
async def get_log_stats(request: Request, auth: Dict[str, Any] = Depends(require_authentication)):
    return request_logger.get_stats()


@app.post("/logs/clear/", tags=["请求日志"], summary="清除请求日志")
@limiter.limit("10/minute")
async def clear_request_logs(request: Request, current_user: User = Depends(get_current_active_user)):
    request_logger.clear_logs()
    return {"message": "All request logs have been cleared"}


@app.get("/resilience/dashboard/", tags=["仪表盘"], summary="弹性总览仪表盘")
@limiter.limit("60/minute")
async def resilience_dashboard(request: Request, auth: Dict[str, Any] = Depends(require_authentication)):
    return {
        "timestamp": datetime.utcnow().isoformat(),
        "circuit_breakers": {
            "total": len(circuit_breakers),
            "open": sum(1 for cb in circuit_breakers.values() if cb.state == CircuitState.OPEN),
            "half_open": sum(1 for cb in circuit_breakers.values() if cb.state == CircuitState.HALF_OPEN),
            "closed": sum(1 for cb in circuit_breakers.values() if cb.state == CircuitState.CLOSED),
            "details": [cb.get_status() for cb in circuit_breakers.values()]
        },
        "load_balancer": load_balancer.get_stats(),
        "api_keys": {
            "total": len(api_key_manager.api_keys),
            "active": sum(1 for k in api_key_manager.api_keys.values() if k.status == APIKeyStatus.ACTIVE),
            "revoked": sum(1 for k in api_key_manager.api_keys.values() if k.status == APIKeyStatus.REVOKED),
            "inactive": sum(1 for k in api_key_manager.api_keys.values() if k.status == APIKeyStatus.INACTIVE)
        },
        "request_logs": request_logger.get_stats(),
        "dynamic_routes": {
            "total": len(dynamic_route_manager.routes),
            "active": sum(1 for r in dynamic_route_manager.routes.values() if r.is_active),
            "total_usage": sum(r.usage_count for r in dynamic_route_manager.routes.values())
        }
    }


def _serialize_route(route: DynamicRoute) -> Dict[str, Any]:
    return {
        "id": route.id,
        "path": route.path,
        "method": route.method,
        "route_type": route.route_type.value,
        "name": route.name,
        "description": route.description,
        "response_data": route.response_data,
        "response_headers": route.response_headers,
        "status_code": route.status_code,
        "redirect_url": route.redirect_url,
        "proxy_target": route.proxy_target,
        "html_content": route.html_content,
        "delay_ms": route.delay_ms,
        "require_auth": route.require_auth,
        "is_active": route.is_active,
        "usage_count": route.usage_count,
        "tags": route.tags,
        "created_at": route.created_at,
        "updated_at": route.updated_at
    }


@app.post("/dynamic-routes/", tags=["动态路由"], summary="创建动态路由")
@limiter.limit("60/minute")
async def create_dynamic_route(
    request: Request,
    route_data: CreateDynamicRouteRequest,
    auth: Dict[str, Any] = Depends(require_authentication)
):
    """
    创建一个新的动态路由。
    
    路由路径将自动以 `/dynamic/` 开头。
    
    **支持的路由类型：**
    - `json`: 返回预定义的 JSON 数据
    - `html`: 返回 HTML 内容
    - `redirect`: 重定向到指定 URL
    - `proxy`: 代理请求到目标 URL
    - `echo`: 回显请求内容
    """
    try:
        route = dynamic_route_manager.create_route(route_data.model_dump())
        return _serialize_route(route)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@app.get("/dynamic-routes/", tags=["动态路由"], summary="获取所有动态路由")
@limiter.limit("120/minute")
async def list_dynamic_routes(
    request: Request,
    auth: Dict[str, Any] = Depends(require_authentication)
):
    """获取所有已注册的动态路由列表"""
    routes = dynamic_route_manager.list_routes()
    return {
        "total": len(routes),
        "routes": [_serialize_route(r) for r in routes]
    }


@app.get("/dynamic-routes/{route_id}", tags=["动态路由"], summary="获取单个动态路由")
@limiter.limit("120/minute")
async def get_dynamic_route(
    route_id: str,
    request: Request,
    auth: Dict[str, Any] = Depends(require_authentication)
):
    """获取指定 ID 的动态路由详情"""
    route = dynamic_route_manager.get_route(route_id)
    if not route:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"动态路由 '{route_id}' 不存在"
        )
    return _serialize_route(route)


@app.put("/dynamic-routes/{route_id}", tags=["动态路由"], summary="更新动态路由")
@limiter.limit("60/minute")
async def update_dynamic_route(
    route_id: str,
    request: Request,
    update_data: UpdateDynamicRouteRequest,
    auth: Dict[str, Any] = Depends(require_authentication)
):
    """更新动态路由的配置"""
    update_dict = update_data.model_dump(exclude_unset=True)
    route = dynamic_route_manager.update_route(route_id, update_dict)
    if not route:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"动态路由 '{route_id}' 不存在"
        )
    return _serialize_route(route)


@app.delete("/dynamic-routes/{route_id}", tags=["动态路由"], summary="删除动态路由")
@limiter.limit("30/minute")
async def delete_dynamic_route(
    route_id: str,
    request: Request,
    auth: Dict[str, Any] = Depends(require_authentication)
):
    """删除指定的动态路由"""
    if not dynamic_route_manager.delete_route(route_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"动态路由 '{route_id}' 不存在"
        )
    return {"message": f"动态路由 '{route_id}' 已删除"}


@app.post("/dynamic-routes/{route_id}/toggle", tags=["动态路由"], summary="切换路由状态")
@limiter.limit("60/minute")
async def toggle_dynamic_route(
    route_id: str,
    request: Request,
    is_active: bool = True,
    auth: Dict[str, Any] = Depends(require_authentication)
):
    """
    切换动态路由的启用/禁用状态。
    
    - **is_active**: true=启用，false=禁用
    """
    route = dynamic_route_manager.toggle_route(route_id, is_active)
    if not route:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"动态路由 '{route_id}' 不存在"
        )
    return _serialize_route(route)


@app.get("/dynamic-routes/stats/overview", tags=["动态路由"], summary="获取动态路由统计")
@limiter.limit("60/minute")
async def get_dynamic_routes_stats(
    request: Request,
    auth: Dict[str, Any] = Depends(require_authentication)
):
    """获取动态路由系统的统计信息"""
    routes = dynamic_route_manager.list_routes()
    return {
        "total_routes": len(routes),
        "active_routes": sum(1 for r in routes if r.is_active),
        "inactive_routes": sum(1 for r in routes if not r.is_active),
        "total_usage": sum(r.usage_count for r in routes),
        "route_types": {
            "json": sum(1 for r in routes if r.route_type == RouteType.JSON),
            "html": sum(1 for r in routes if r.route_type == RouteType.HTML),
            "redirect": sum(1 for r in routes if r.route_type == RouteType.REDIRECT),
            "proxy": sum(1 for r in routes if r.route_type == RouteType.PROXY),
            "echo": sum(1 for r in routes if r.route_type == RouteType.ECHO),
            "static": sum(1 for r in routes if r.route_type == RouteType.STATIC)
        },
        "top_routes": sorted(
            [{"path": r.path, "usage": r.usage_count} for r in routes if r.usage_count > 0],
            key=lambda x: x["usage"],
            reverse=True
        )[:10]
    }


@app.get("/openapi-export/", tags=["其他"], summary="导出 OpenAPI 规范")
@limiter.limit("10/minute")
async def export_openapi_spec(request: Request, format: str = "json", auth: Dict[str, Any] = Depends(require_authentication)):
    """
    导出 OpenAPI 规范文档。
    
    - **format**: json 或 yaml
    """
    openapi_schema = app.openapi()
    
    if format == "yaml":
        try:
            import yaml
            yaml_content = yaml.dump(openapi_schema, default_flow_style=False, sort_keys=False)
            return Response(
                content=yaml_content,
                media_type="application/yaml",
                headers={
                    "Content-Disposition": f"attachment; filename=openapi-{datetime.now().strftime('%Y%m%d-%H%M%S')}.yaml"
                }
            )
        except ImportError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="PyYAML is not installed. Use format=json."
            )
    
    return JSONResponse(
        content=openapi_schema,
        headers={
            "Content-Disposition": f"attachment; filename=openapi-{datetime.now().strftime('%Y%m%d-%H%M%S')}.json"
        }
    )


@app.get("/", include_in_schema=False)
async def root():
    return FileResponse("static/index.html")

app.mount("/static", StaticFiles(directory="static"), name="static")

if __name__ == "__main__":
    import uvicorn
    os.makedirs("static", exist_ok=True)
    uvicorn.run(app, host="0.0.0.0", port=8000)
