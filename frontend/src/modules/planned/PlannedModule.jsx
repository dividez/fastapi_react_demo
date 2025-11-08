export default function PlannedModule({ title, subtitle, highlights = [] }) {
  return (
    <>
      <header className="page__header">
        <div>
          <h1>{title}</h1>
          <p className="page__subtitle">{subtitle}</p>
        </div>
        <div className="module-status">功能设计中，欢迎关注更新。</div>
      </header>

      <main className="page__content">
        <section className="module-placeholder">
          <h2>核心能力预告</h2>
          <p>以下特性正在规划与设计中：</p>
          <ul>
            {highlights.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      </main>
    </>
  );
}
