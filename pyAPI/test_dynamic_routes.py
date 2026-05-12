import urllib.request
import urllib.error
import urllib.parse
import json

print('=== 1. 登录获取 JWT Token ===')
login_data = urllib.parse.urlencode({'username': 'admin', 'password': 'password'}).encode('utf-8')
req = urllib.request.Request('http://localhost:8001/token', data=login_data, headers={'Content-Type': 'application/x-www-form-urlencoded'})
try:
    response = urllib.request.urlopen(req)
    data = json.loads(response.read().decode('utf-8'))
    token = data.get('access_token')
    print(f'获取 token 成功: {token[:30]}...')
except urllib.error.HTTPError as e:
    print(f'登录失败: {e.code} - {e.read().decode()}')
    exit(1)

headers = {
    'Content-Type': 'application/json',
    'Authorization': f'Bearer {token}'
}

print()
print('=== 2. 测试默认动态路由 ===')

try:
    req = urllib.request.Request('http://localhost:8001/dynamic/hello', headers=headers)
    response = urllib.request.urlopen(req)
    data = json.loads(response.read().decode('utf-8'))
    print('/dynamic/hello 测试成功')
    print(json.dumps(data, indent=2, ensure_ascii=False))
except urllib.error.HTTPError as e:
    print(f'/dynamic/hello 失败: {e.code}')

print()

try:
    req = urllib.request.Request('http://localhost:8001/dynamic/status', headers=headers)
    response = urllib.request.urlopen(req)
    data = json.loads(response.read().decode('utf-8'))
    print('/dynamic/status 测试成功')
    print(json.dumps(data, indent=2, ensure_ascii=False))
except urllib.error.HTTPError as e:
    print(f'/dynamic/status 失败: {e.code}')

print()
print('=== 3. 创建新的动态路由 ===')

route1_data = json.dumps({
    'path': 'test1',
    'name': '测试路由 1',
    'method': 'GET',
    'route_type': 'json',
    'response_data': {'message': '这是一个测试路由', 'version': '1.0', 'data': [1, 2, 3]}
}).encode('utf-8')

req = urllib.request.Request('http://localhost:8001/dynamic-routes/', data=route1_data, headers=headers)
try:
    response = urllib.request.urlopen(req)
    data = json.loads(response.read().decode('utf-8'))
    route1_id = data.get('id')
    route1_path = data.get('path')
    print(f'创建路由 1 成功: {route1_id} - {route1_path}')
except urllib.error.HTTPError as e:
    print(f'创建路由 1 失败: {e.code} - {e.read().decode()}')
    exit(1)

print()

route2_data = json.dumps({
    'path': 'my-echo',
    'name': '我的 Echo 服务',
    'method': 'POST',
    'route_type': 'echo'
}).encode('utf-8')

req = urllib.request.Request('http://localhost:8001/dynamic-routes/', data=route2_data, headers=headers)
try:
    response = urllib.request.urlopen(req)
    data = json.loads(response.read().decode('utf-8'))
    route2_id = data.get('id')
    route2_path = data.get('path')
    print(f'创建路由 2 成功: {route2_id} - {route2_path}')
except urllib.error.HTTPError as e:
    print(f'创建路由 2 失败: {e.code} - {e.read().decode()}')

print()
print('=== 4. 测试新创建的路由 ===')

try:
    req = urllib.request.Request(f'http://localhost:8001{route1_path}', headers=headers)
    response = urllib.request.urlopen(req)
    data = json.loads(response.read().decode('utf-8'))
    print(f'{route1_path} 测试成功:')
    print(json.dumps(data, indent=2, ensure_ascii=False)[:300])
except urllib.error.HTTPError as e:
    print(f'{route1_path} 失败: {e.code}')

print()

try:
    test_body = json.dumps({'name': '测试用户', 'email': 'test@example.com', 'items': ['a', 'b', 'c']}).encode('utf-8')
    req = urllib.request.Request(f'http://localhost:8001{route2_path}', data=test_body, headers=headers)
    response = urllib.request.urlopen(req)
    data = json.loads(response.read().decode('utf-8'))
    print(f'{route2_path} Echo 测试成功:')
    print(f'  方法: {data.get("method")}')
    print(f'  路径: {data.get("path")}')
    print(f'  请求体: {json.dumps(data.get("body"), ensure_ascii=False)}')
except urllib.error.HTTPError as e:
    print(f'{route2_path} 失败: {e.code}')

print()
print('=== 5. 列出所有动态路由 ===')

req = urllib.request.Request('http://localhost:8001/dynamic-routes/', headers=headers)
try:
    response = urllib.request.urlopen(req)
    data = json.loads(response.read().decode('utf-8'))
    print(f'总路由数: {data.get("total")}')
    for r in data.get('routes', []):
        print(f'  {r.get("method")} {r.get("path")} - {r.get("name")} [类型: {r.get("route_type")}, 活跃: {r.get("is_active")}]')
except urllib.error.HTTPError as e:
    print(f'获取路由列表失败: {e.code}')

print()
print('=== 6. 动态路由统计 ===')

req = urllib.request.Request('http://localhost:8001/dynamic-routes/stats/overview', headers=headers)
try:
    response = urllib.request.urlopen(req)
    data = json.loads(response.read().decode('utf-8'))
    print(f'总路由数: {data.get("total_routes")}')
    print(f'活跃路由数: {data.get("active_routes")}')
    print(f'总使用次数: {data.get("total_usage")}')
    print(f'路由类型分布: {json.dumps(data.get("route_types"), ensure_ascii=False)}')
except urllib.error.HTTPError as e:
    print(f'获取统计失败: {e.code}')

print()
print('=== 7. 仪表盘 (包含动态路由统计) ===')

req = urllib.request.Request('http://localhost:8001/resilience/dashboard/', headers=headers)
try:
    response = urllib.request.urlopen(req)
    data = json.loads(response.read().decode('utf-8'))
    dr = data.get('dynamic_routes', {})
    print(f'动态路由统计: 总={dr.get("total")}, 活跃={dr.get("active")}, 总使用={dr.get("total_usage")}')
except urllib.error.HTTPError as e:
    print(f'获取仪表盘失败: {e.code}')

print()
print('=== 8. 测试延迟路由 ===')

print('测试 /dynamic/delay (2秒延迟)...')
import time
start = time.time()
try:
    req = urllib.request.Request('http://localhost:8001/dynamic/delay', headers=headers)
    response = urllib.request.urlopen(req)
    data = json.loads(response.read().decode('utf-8'))
    elapsed = time.time() - start
    print(f'延迟路由测试成功，耗时: {elapsed:.2f}秒')
except urllib.error.HTTPError as e:
    print(f'延迟路由失败: {e.code}')

print()
print('✅ 所有测试完成!')
