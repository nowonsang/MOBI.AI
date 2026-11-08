// main 서비스 전용 레이아웃. 서비스별 헤더·내비게이션은 각 라우트 그룹의 layout에 둔다.
export default function MainLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-24">
      {children}
    </main>
  );
}
