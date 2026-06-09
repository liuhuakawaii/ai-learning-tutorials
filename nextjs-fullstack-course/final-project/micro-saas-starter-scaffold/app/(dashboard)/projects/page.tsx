const projects = [
  { id: 'p1', name: 'Launch Plan', status: 'active' },
  { id: 'p2', name: 'AI Writing Kit', status: 'draft' }
];

export default function ProjectsPage() {
  return (
    <main>
      <h1>项目</h1>
      <form>
        <input name="keyword" placeholder="搜索项目" />
        <button type="submit">搜索</button>
      </form>
      <ul>
        {projects.map((project) => (
          <li key={project.id}>{project.name} - {project.status}</li>
        ))}
      </ul>
    </main>
  );
}
