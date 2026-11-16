import Link from "next/link";

export default function NotFound() {
  return (
    <main className="page">
      <div className="empty-state">
        <h1>这页不存在</h1>
        <p>可能被撤下了，或者地址写错了。</p>
        <Link className="btn btn-primary" href="/">
          回今天拍啥
        </Link>
      </div>
    </main>
  );
}
