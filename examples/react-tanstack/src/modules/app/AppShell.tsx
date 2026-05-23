import { Link, Outlet } from "@tanstack/react-router";

export function AppShell() {
	return (
		<div className="app">
			<header className="topbar">
				<div>
					<p className="eyebrow">awilixify frontend</p>
					<h1>React TanStack</h1>
				</div>
				<nav>
					<Link to="/" activeProps={{ className: "active" }}>
						Projects
					</Link>
					<Link to="/about" activeProps={{ className: "active" }}>
						About
					</Link>
				</nav>
			</header>
			<main>
				<Outlet />
			</main>
		</div>
	);
}
