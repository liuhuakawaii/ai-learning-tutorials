export default function LoginPage() {
  return (
    <main>
      <h1>登录</h1>
      <form>
        <label>
          邮箱
          <input name="email" type="email" />
        </label>
        <button type="submit">登录</button>
      </form>
    </main>
  );
}
