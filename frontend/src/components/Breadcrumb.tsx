import { Link } from "react-router-dom";

interface BreadcrumbItem {
	label: string;
	path?: string;
	state?: any;
	active?: boolean;
}

interface BreadcrumbProps {
	items: BreadcrumbItem[];
}

export default function Breadcrumb({ items }: BreadcrumbProps) {
	return (
		<nav className="breadcrumb">
			<ol className="breadcrumb-list">
				{items.map((item, index) => (
					<li key={index} className="breadcrumb-item">
						{item.path && !item.active ? (
							<Link
								to={item.path}
								state={item.state}
								className="breadcrumb-link"
							>
								{item.label}
							</Link>
						) : (
							<span
								className={`breadcrumb-current ${item.active ? "active" : ""}`}
							>
								{item.label}
							</span>
						)}
						{index < items.length - 1 && (
							<span className="breadcrumb-separator">›</span>
						)}
					</li>
				))}
			</ol>
		</nav>
	);
}
