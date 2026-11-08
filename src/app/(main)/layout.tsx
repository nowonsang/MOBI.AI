// 메인 라우트 그룹 레이아웃. 서비스별 헤더·내비게이션은 각 라우트 그룹의 layout에 둔다.
// 반응형 기준(ui-design 스킬): 모바일 좌우 20px → md 24px → lg 30px, 본문 폭 max-w-content.
export default function MainLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="mx-auto flex w-full max-w-content flex-1 flex-col gap-6 px-5 py-12 md:px-6 md:py-16 lg:px-7.5 lg:py-20">
      {children}
    </main>
  );
}
