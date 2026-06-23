# 04. 路由架构设计 —— 路由守卫、动态路由、路由懒加载、面包屑生成

> 路由不只是 URL 和页面的映射——它是用户导航的骨架，也是权限控制的入口

## 本课目标

- 理解路由在前端架构中的核心地位
- 实现路由守卫（认证守卫、权限守卫、角色守卫）
- 设计动态路由方案（基于权限的菜单和路由）
- 掌握路由懒加载的最佳实践
- 实现自动面包屑生成

## 路由不只是跳转

新手对路由的理解是"点击链接跳转到页面"。但在真实项目中，路由要解决的问题远不止这些：

```
路由需要解决的问题：

1. URL 和页面的映射关系
2. 用户未登录时访问需要登录的页面 → 重定向到登录页
3. 普通用户访问管理员页面 → 403 或重定向
4. 根据用户权限动态生成菜单和路由
5. 页面切换时的加载状态
6. 面包屑导航
7. 页面标题（document.title）
8. 滚动行为（切换页面后回到顶部，还是保持位置）
9. 路由参数的类型安全
10. 嵌套路由的布局管理
```

## 路由守卫

路由守卫是路由架构中最常用的功能。核心思想是：**在路由切换前，检查用户是否有权限访问目标页面**。

### React 路由守卫

React Router 没有内置的路由守卫机制，需要自己实现：

```tsx
import { Navigate, useLocation } from 'react-router-dom';

// 基础认证守卫
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!user) {
    // 保存当前 URL，登录后可以跳回来
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

// 使用
function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/dashboard" element={
        <RequireAuth>
          <Dashboard />
        </RequireAuth>
      } />
      <Route path="/admin" element={
        <RequireAuth>
          <AdminPanel />
        </RequireAuth>
      } />
    </Routes>
  );
}
```

### 权限守卫

```tsx
// 权限守卫：检查用户是否有特定权限
function RequirePermission({
  permission,
  fallback = <AccessDenied />,
  children,
}: {
  permission: string;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { user } = useAuth();

  if (!user?.permissions.includes(permission)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

// 角色守卫：检查用户是否有特定角色
function RequireRole({
  roles,
  children,
}: {
  roles: string[];
  children: React.ReactNode;
}) {
  const { user } = useAuth();

  if (!roles.includes(user?.role)) {
    return <Navigate to="/403" replace />;
  }

  return <>{children}</>;
}

// 使用
<Route path="/admin/users" element={
  <RequireAuth>
    <RequireRole roles={['admin', 'super-admin']}>
      <UserManagement />
    </RequireRole>
  </RequireAuth>
} />

<Route path="/settings" element={
  <RequireAuth>
    <RequirePermission permission="settings:write">
      <Settings />
    </RequirePermission>
  </RequireAuth>
} />
```

### 组合守卫

多个守卫嵌套会导致代码难以阅读。可以用一个通用的守卫组件：

```tsx
interface GuardConfig {
  auth?: boolean;
  roles?: string[];
  permissions?: string[];
}

function GuardedRoute({ config, children }: { config: GuardConfig; children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <LoadingScreen />;

  // 认证检查
  if (config.auth && !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 角色检查
  if (config.roles && !config.roles.includes(user?.role)) {
    return <Navigate to="/403" replace />;
  }

  // 权限检查
  if (config.permissions && !config.permissions.every(p => user?.permissions.includes(p))) {
    return <Navigate to="/403" replace />;
  }

  return <>{children}</>;
}

// 使用：配置式路由守卫
const routeConfig = [
  { path: '/dashboard', element: <Dashboard />, guard: { auth: true } },
  { path: '/admin', element: <Admin />, guard: { auth: true, roles: ['admin'] } },
  { path: '/settings', element: <Settings />, guard: { auth: true, permissions: ['settings:write'] } },
  { path: '/public', element: <PublicPage /> },
];
```

## 动态路由

在后台管理系统中，菜单和路由通常由后端返回。前端需要根据用户权限动态生成路由。

### 路由数据结构

```typescript
// 后端返回的菜单/路由数据
interface RouteMeta {
  key: string;          // 唯一标识
  label: string;        // 菜单显示名称
  icon?: string;        // 图标
  path: string;         // 路由路径
  component: string;    // 组件标识（前端映射）
  children?: RouteMeta[];
  permission?: string;  // 所需权限
  hidden?: boolean;     // 是否在菜单中隐藏
}

// 后端返回示例
const menuData: RouteMeta[] = [
  {
    key: 'dashboard',
    label: '仪表盘',
    icon: 'DashboardOutlined',
    path: '/dashboard',
    component: 'Dashboard',
  },
  {
    key: 'user',
    label: '用户管理',
    icon: 'UserOutlined',
    path: '/user',
    component: 'UserLayout',
    permission: 'user:read',
    children: [
      {
        key: 'user-list',
        label: '用户列表',
        path: '/user/list',
        component: 'UserList',
        permission: 'user:read',
      },
      {
        key: 'user-create',
        label: '创建用户',
        path: '/user/create',
        component: 'UserForm',
        permission: 'user:write',
      },
    ],
  },
];
```

### 组件映射

```typescript
// 组件映射表：将后端返回的 component 字符串映射到实际组件
import Dashboard from '@/pages/Dashboard';
import UserLayout from '@/pages/User/Layout';
import UserList from '@/pages/User/List';
import UserForm from '@/pages/User/Form';

const componentMap: Record<string, React.ComponentType> = {
  Dashboard,
  UserLayout,
  UserList,
  UserForm,
};

// 动态生成路由
function generateRoutes(menus: RouteMeta[]): RouteObject[] {
  return menus.map((menu) => {
    const Component = componentMap[menu.component];

    if (!Component) {
      console.warn(`组件 ${menu.component} 未注册`);
      return null;
    }

    const route: RouteObject = {
      path: menu.path,
      element: <Component />,
    };

    if (menu.children?.length) {
      route.children = generateRoutes(menu.children);
    }

    return route;
  }).filter(Boolean);
}
```

### 动态菜单生成

```typescript
// 从路由数据生成菜单
import { Menu } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';

function DynamicMenu({ menus }: { menus: RouteMeta[] }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  // 过滤用户有权限访问的菜单
  const filteredMenus = filterMenusByPermission(menus, user?.permissions);

  // 转换为 antd Menu 的 items 格式
  const menuItems = filteredMenus.map((menu) => ({
    key: menu.path,
    icon: menu.icon ? <Icon name={menu.icon} /> : null,
    label: menu.label,
    children: menu.children?.map((child) => ({
      key: child.path,
      label: child.label,
    })),
  }));

  return (
    <Menu
      items={menuItems}
      selectedKeys={[location.pathname]}
      onClick={({ key }) => navigate(key)}
    />
  );
}

// 权限过滤
function filterMenusByPermission(menus: RouteMeta[], permissions: string[]): RouteMeta[] {
  return menus
    .filter((menu) => {
      if (!menu.permission) return true;
      return permissions.includes(menu.permission);
    })
    .map((menu) => ({
      ...menu,
      children: menu.children
        ? filterMenusByPermission(menu.children, permissions)
        : undefined,
    }))
    .filter((menu) => menu.children?.length || !menu.hidden);
}
```

## 路由懒加载

在第 5 课（代码分割）中已经详细介绍过。这里补充路由懒加载的架构层面考虑：

```typescript
import { lazy, Suspense } from 'react';

// 组件映射表改为懒加载版本
const componentMap: Record<string, React.LazyExoticComponent<React.ComponentType>> = {
  Dashboard: lazy(() => import('@/pages/Dashboard')),
  UserLayout: lazy(() => import('@/pages/User/Layout')),
  UserList: lazy(() => import('@/pages/User/List')),
  UserForm: lazy(() => import('@/pages/User/Form')),
};

// 生成路由时使用 Suspense 包裹
function generateRoutes(menus: RouteMeta[]): RouteObject[] {
  return menus.map((menu) => {
    const LazyComponent = componentMap[menu.component];

    if (!LazyComponent) return null;

    return {
      path: menu.path,
      element: (
        <Suspense fallback={<PageSkeleton />}>
          <LazyComponent />
        </Suspense>
      ),
      children: menu.children ? generateRoutes(menu.children) : undefined,
    };
  }).filter(Boolean);
}
```

## 面包屑生成

面包屑是导航的重要组成部分。手动维护面包屑容易和路由配置不同步。

### 基于路由配置自动生成

```typescript
// 在路由配置中添加面包屑信息
interface RouteWithBreadcrumb {
  path: string;
  breadcrumb: string | ((params: Record<string, string>) => string);
  children?: RouteWithBreadcrumb[];
}

const routeConfig: RouteWithBreadcrumb[] = [
  {
    path: '/dashboard',
    breadcrumb: '仪表盘',
  },
  {
    path: '/user',
    breadcrumb: '用户管理',
    children: [
      { path: '/user/list', breadcrumb: '用户列表' },
      { path: '/user/:id', breadcrumb: (params) => `用户 ${params.id}` },
    ],
  },
];

// 从当前 URL 生成面包屑
function useBreadcrumbs(): BreadcrumbItem[] {
  const location = useLocation();
  const params = useParams();

  const pathSnippets = location.pathname.split('/').filter((i) => i);

  return pathSnippets.map((_, index) => {
    const url = `/${pathSnippets.slice(0, index + 1).join('/')}`;
    const route = findRoute(routeConfig, url);

    return {
      path: url,
      label: typeof route?.breadcrumb === 'function'
        ? route.breadcrumb(params)
        : route?.breadcrumb || url,
    };
  });
}

// 使用
function PageHeader() {
  const breadcrumbs = useBreadcrumbs();

  return (
    <Breadcrumb>
      <Breadcrumb.Item>
        <Link to="/">首页</Link>
      </Breadcrumb.Item>
      {breadcrumbs.map((item, index) => (
        <Breadcrumb.Item key={item.path}>
          {index === breadcrumbs.length - 1 ? (
            item.label
          ) : (
            <Link to={item.path}>{item.label}</Link>
          )}
        </Breadcrumb.Item>
      ))}
    </Breadcrumb>
  );
}
```

### Vue Router 面包屑

```typescript
// Vue Router 支持 meta 字段，可以直接在路由配置中定义面包屑
const routes = [
  {
    path: '/dashboard',
    component: Dashboard,
    meta: { breadcrumb: '仪表盘' },
  },
  {
    path: '/user',
    component: UserLayout,
    meta: { breadcrumb: '用户管理' },
    children: [
      {
        path: 'list',
        component: UserList,
        meta: { breadcrumb: '用户列表' },
      },
      {
        path: ':id',
        component: UserDetail,
        meta: { breadcrumb: (route) => `用户 ${route.params.id}` },
      },
    ],
  },
];

// 面包屑组件
function Breadcrumb() {
  const route = useRoute();

  const breadcrumbs = route.matched
    .filter((record) => record.meta.breadcrumb)
    .map((record) => ({
      path: record.path,
      label: typeof record.meta.breadcrumb === 'function'
        ? record.meta.breadcrumb(route)
        : record.meta.breadcrumb,
    }));

  return (
    <nav>
      {breadcrumbs.map((item) => (
        <span key={item.path}>
          <router-link to={item.path}>{item.label}</router-link>
        </span>
      ))}
    </nav>
  );
}
```

## 练习

### 练习一：设计路由守卫方案

一个后台管理系统有以下角色和权限：

```
角色：
- super-admin：所有权限
- admin：用户管理、订单管理、商品管理
- editor：商品管理（只读）、内容管理
- viewer：只读访问所有页面

页面权限要求：
- /admin/users：需要 user:read 权限
- /admin/users/create：需要 user:write 权限
- /admin/orders：需要 order:read 权限
- /admin/settings：需要 super-admin 角色
- /dashboard：登录即可
```

请设计一个路由守卫方案，支持角色和权限两种控制方式。

### 练习二：实现动态面包屑

给定以下路由配置，实现一个能自动生成面包屑的 Hook：

```
路由结构：
/ → 首页
/dashboard → 仪表盘
/products → 商品管理
/products/list → 商品列表
/products/:id → 商品详情（面包屑显示商品名称）
/products/:id/edit → 编辑商品
/orders → 订单管理
/orders/list → 订单列表
```

---

## 参考答案

### 练习一

```typescript
// 权限配置
const routePermissions: Record<string, { roles?: string[]; permissions?: string[] }> = {
  '/admin/users': { permissions: ['user:read'] },
  '/admin/users/create': { permissions: ['user:write'] },
  '/admin/orders': { permissions: ['order:read'] },
  '/admin/settings': { roles: ['super-admin'] },
  '/dashboard': {}, // 登录即可
};

// 守卫组件
function RouteGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;

  const config = routePermissions[location.pathname];

  if (!config) return <>{children}</>;

  // 角色检查
  if (config.roles && !config.roles.includes(user.role)) {
    return <Navigate to="/403" replace />;
  }

  // 权限检查
  if (config.permissions?.length) {
    const hasPermission = config.permissions.some(p => user.permissions.includes(p));
    if (!hasPermission) return <Navigate to="/403" replace />;
  }

  return <>{children}</>;
}
```

### 练习二

```typescript
interface BreadcrumbItem {
  path: string;
  label: string;
}

// 路由面包屑配置
const breadcrumbConfig: Record<string, string | ((params: any, data?: any) => string)> = {
  '/': '首页',
  '/dashboard': '仪表盘',
  '/products': '商品管理',
  '/products/list': '商品列表',
  '/products/:id': (params, data) => data?.name || `商品 ${params.id}`,
  '/products/:id/edit': '编辑商品',
  '/orders': '订单管理',
  '/orders/list': '订单列表',
};

function useBreadcrumbs(): BreadcrumbItem[] {
  const location = useLocation();
  const params = useParams();
  const [productData, setProductData] = useState(null);

  // 如果是商品详情页，获取商品名称
  useEffect(() => {
    if (location.pathname.match(/^\/products\/\d+$/)) {
      const id = location.pathname.split('/')[2];
      fetchProduct(id).then(setProductData);
    }
  }, [location.pathname]);

  const pathSnippets = location.pathname.split('/').filter(Boolean);

  const crumbs: BreadcrumbItem[] = [{ path: '/', label: '首页' }];

  let currentPath = '';
  for (const snippet of pathSnippets) {
    currentPath += `/${snippet}`;

    // 尝试精确匹配
    let config = breadcrumbConfig[currentPath];

    // 尝试参数匹配
    if (!config) {
      const paramPath = currentPath.replace(/\/[^/]+/g, (match, offset) => {
        const parts = currentPath.substring(0, offset + match.length).split('/');
        const paramName = `:${parts[parts.length - 1]}`;
        return `/${paramName}`;
      });
      config = breadcrumbConfig[paramPath];
    }

    if (config) {
      crumbs.push({
        path: currentPath,
        label: typeof config === 'function' ? config(params, productData) : config,
      });
    }
  }

  return crumbs;
}
```

## 下一步

完成本课后，继续学习 [05. 微前端架构](./05-micro-frontend.md)。
