import { NavLink, useMatch } from "react-router-dom"
import { LogOut } from "lucide-react"
import { cn, focusRing } from "@/lib/utils"
import { Logo } from "@/components/logo"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar"

function NavItem({ to, label, icon: Icon, end }) {
  const isActive = Boolean(useMatch({ path: to, end: end ?? true }))
  const { setOpenMobile } = useSidebar()

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={isActive}>
        <NavLink to={to} end={end} onClick={() => setOpenMobile(false)}>
          {Icon && <Icon aria-hidden="true" />}
          <span>{label}</span>
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

const initials = (name = "") =>
  name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase()

/**
 * Sidebar + top bar shell shared by the author and admin areas.
 * navItems: [{ to, label, icon: LucideIcon, end?: bool }]
 * user: { name, email?, role: "author" | "admin" }
 * Below 768px the sidebar becomes shadcn's Sheet drawer (opened by SidebarTrigger).
 * sidebarStyle lets a layout re-point --sidebar (e.g. white for authors).
 */
function AppShell({
  navItems = [],
  title,
  user,
  onLogout,
  actions,
  navLabel = "Main navigation",
  sidebarStyle,
  contentClassName,
  children,
}) {
  return (
    <SidebarProvider style={sidebarStyle}>
      <Sidebar>
        <SidebarHeader className="h-14 justify-center border-b border-sidebar-border px-4">
          <Logo />
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <nav aria-label={navLabel}>
                <SidebarMenu>
                  {navItems.map((item) => (
                    <NavItem key={item.to} {...item} />
                  ))}
                </SidebarMenu>
              </nav>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>

      <SidebarInset className="min-w-0 bg-background">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-border bg-surface px-3 md:px-6">
          <SidebarTrigger className="md:hidden" aria-label="Open menu" />
          <h1 className="min-w-0 flex-1 truncate text-lg">{title}</h1>
          {actions}
          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger
                className={cn("flex items-center gap-2 rounded-pill p-1 pr-2 hover:bg-accent", focusRing)}
                aria-label={`Account menu for ${user.name}`}
              >
                <Avatar className="size-8">
                  <AvatarFallback className="bg-tint text-xs font-bold text-primary-strong">
                    {initials(user.name)}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden text-sm font-semibold sm:inline">{user.name}</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="grid gap-1">
                  <span className="font-bold">{user.name}</span>
                  {user.email && <span className="text-xs font-normal text-muted-foreground">{user.email}</span>}
                  <Badge variant={user.role === "admin" ? "neutral" : "default"} uppercase>
                    {user.role === "admin" ? "Admin" : "Author"}
                  </Badge>
                </DropdownMenuLabel>
                {onLogout && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={onLogout}>
                      <LogOut aria-hidden="true" />
                      Log out
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </header>

        <main className={cn("w-full flex-1 px-4 py-6 md:px-6", contentClassName)}>{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}

export { AppShell }
