import { pleos } from "@/shared/pleos/pleos";

/** 질문을 음성으로 들려준 뒤 한 문장을 듣는다. */
export async function askByVoice(question: string): Promise<string> {
  await pleos().speak(question);
  return pleos().listen();
}

/** 안내 음성은 실패해도 흐름을 막지 않는다. */
export async function speakQuietly(text: string): Promise<void> {
  try {
    await pleos().speak(text);
  } catch {
    // 음성 안내가 없어도 화면 문구로 같은 내용을 보여 준다.
  }
}
