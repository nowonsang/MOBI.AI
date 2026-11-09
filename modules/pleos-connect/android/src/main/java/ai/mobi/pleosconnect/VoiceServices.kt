package ai.mobi.pleosconnect

import ai.pleos.playground.stt.SpeechToText
import ai.pleos.playground.tts.TextToSpeech
import android.content.Context
import android.content.pm.PackageManager
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withTimeout
import java.util.Locale
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import ai.pleos.playground.stt.constant.ErrorType as SttError
import ai.pleos.playground.stt.constant.Mode as SttMode
import ai.pleos.playground.stt.listener.OnInitializeListener as SttInitListener
import ai.pleos.playground.stt.listener.OnServerConnectionListener as SttConnectionListener
import ai.pleos.playground.stt.listener.ResultListener as SttResultListener
import ai.pleos.playground.tts.constant.ErrorType as TtsError
import ai.pleos.playground.tts.constant.Mode as TtsMode
import ai.pleos.playground.tts.listener.EventListener as TtsEventListener
import ai.pleos.playground.tts.listener.OnInitializeListener as TtsInitListener
import ai.pleos.playground.tts.listener.OnServerConnectionListener as TtsConnectionListener

// Pleos Playground > My Project 의 SDK 클라이언트 ID·시크릿. 앱 설정 플러그인(app.plugin.js)이 매니페스트 meta-data 로 넣는다.
data class PleosCredentials(val clientId: String, val clientSecret: String) {
  companion object {
    fun from(context: Context): PleosCredentials? {
      @Suppress("DEPRECATION")
      val meta =
        context.packageManager
          .getApplicationInfo(context.packageName, PackageManager.GET_META_DATA)
          .metaData ?: return null
      val id = meta.getString("ai.mobi.pleos.CLIENT_ID")
      val secret = meta.getString("ai.mobi.pleos.CLIENT_SECRET")
      return if (id.isNullOrBlank() || secret.isNullOrBlank()) null else PleosCredentials(id, secret)
    }
  }
}

// 음성 인식(STT)·음성 안내(TTS). 등록 정보가 있으면 하이브리드(서버) 모드, 없으면 온디바이스 모드로 쓴다.
// 두 SDK 는 Pleos Playground 에서 "준비 중" 상태라 실차 배포 전 사용 승인을 다시 확인해야 한다.
// 각 클라이언트는 처음 쓸 때 만들고, 동시에 한 요청만 처리한다.
class VoiceServices(
  private val context: Context,
  private val credentials: PleosCredentials?,
) {
  private val sttLock = Mutex()
  private val ttsLock = Mutex()
  private var stt: SpeechToText? = null
  private var tts: TextToSpeech? = null

  suspend fun listen(onPartial: (String) -> Unit): String =
    sttLock.withLock {
      val client = speechToText()
      try {
        withTimeout(LISTEN_TIMEOUT_MS) {
          suspendCancellableCoroutine<String> { cont ->
            val listener =
              object : SttResultListener {
                override fun onUpdated(text: String, isFinal: Boolean) {
                  if (!isFinal) return onPartial(text)
                  client.removeListener(this)
                  if (cont.isActive) cont.resume(text)
                }

                override fun onError(error: SttError) {
                  client.removeListener(this)
                  if (cont.isActive) cont.resumeWithException(PleosServiceException("음성 인식 실패: $error"))
                }

                override fun onUpdatedEpdData(epdOn: Long, epdOff: Long) = Unit

                override fun onStartedRecognition() = Unit

                override fun onEndedRecognition() = Unit

                override fun onReady() = Unit

                override fun onUpdatedRms(rms: Double) = Unit
              }
            client.addListener(listener)
            cont.invokeOnCancellation {
              client.stop()
              client.removeListener(listener)
            }
            client.request()
          }
        }
      } catch (e: TimeoutCancellationException) {
        throw PleosServiceException("음성이 ${LISTEN_TIMEOUT_MS / 1000}초 안에 인식되지 않았습니다", e)
      }
    }

  fun stopListening() {
    stt?.stop()
  }

  // Pleos 오디오 포커스·Suspend 가이드: 화면에서 사라지면 재생·인식을 즉시 멈춘다. 다시 보여도 자동으로 이어 하지 않는다.
  fun stopAll() {
    stt?.stop()
    tts?.stop()
  }

  suspend fun speak(text: String) =
    ttsLock.withLock {
      val client = textToSpeech()
      suspendCancellableCoroutine<Unit> { cont ->
        val listener =
          object : TtsEventListener {
            override fun onDone() = finish(null)

            override fun onStop() = finish(null)

            override fun onError(error: TtsError) = finish(PleosServiceException("음성 안내 실패: $error"))

            override fun onStart() = Unit

            override fun onReady() = Unit

            override fun onUpdatedRms(rms: Double) = Unit

            private fun finish(error: Exception?) {
              client.removeEventListener(this)
              if (!cont.isActive) return
              if (error == null) cont.resume(Unit) else cont.resumeWithException(error)
            }
          }
        client.addEventListener(listener)
        cont.invokeOnCancellation {
          client.stop()
          client.removeEventListener(listener)
        }
        // isFinal=true: 스트리밍 조각이 아니라 완성된 문장 하나를 보낸다.
        // Pleos 음성 안내 가이드의 150~200ms 선행 묵음은 앱이 오디오를 직접 재생할 때의 규칙이다.
        // TTS SDK 재생에도 필요한지는 에뮬레이터·실차에서 첫 음절이 잘리는지로 확인한다.
        client.speak(text, true)
      }
    }

  fun release() {
    stt?.release()
    tts?.release()
    stt = null
    tts = null
  }

  private suspend fun speechToText(): SpeechToText {
    stt?.let { return it }
    val client = SpeechToText(context, if (credentials != null) SttMode.HYBRID else SttMode.ON_DEVICE)
    // 초기화·앱 등록에 실패한 클라이언트는 해제하고 버린다 (다시 시도할 때 새로 만든다).
    try {
      suspendCancellableCoroutine<Unit> { cont ->
        client.initialize(
          object : SttInitListener {
            override fun onSuccess() {
              if (cont.isActive) cont.resume(Unit)
            }

            override fun onFailure(error: SttError) {
              if (cont.isActive) cont.resumeWithException(PleosServiceException("음성 인식 초기화 실패: $error"))
            }
          },
        )
      }
      credentials?.let { (id, secret) ->
        suspendCancellableCoroutine<Unit> { cont ->
          client.registerApp(
            id,
            secret,
            object : SttConnectionListener {
              override fun onConnected() {
                if (cont.isActive) cont.resume(Unit)
              }

              override fun onFailed(error: SttError) {
                if (cont.isActive) cont.resumeWithException(PleosServiceException("음성 인식 앱 등록 실패: $error"))
              }
            },
          )
        }
      }
    } catch (e: Throwable) {
      client.release()
      throw e
    }
    client.setLocale(Locale.KOREA)
    return client.also { stt = it }
  }

  private suspend fun textToSpeech(): TextToSpeech {
    tts?.let { return it }
    val client = TextToSpeech(context, if (credentials != null) TtsMode.HYBRID else TtsMode.ON_DEVICE)
    // 초기화·앱 등록에 실패한 클라이언트는 해제하고 버린다 (다시 시도할 때 새로 만든다).
    try {
      suspendCancellableCoroutine<Unit> { cont ->
        client.initialize(
          object : TtsInitListener {
            override fun onSuccess() {
              if (cont.isActive) cont.resume(Unit)
            }

            override fun onFailure(error: TtsError) {
              if (cont.isActive) cont.resumeWithException(PleosServiceException("음성 안내 초기화 실패: $error"))
            }
          },
        )
      }
      credentials?.let { (id, secret) ->
        suspendCancellableCoroutine<Unit> { cont ->
          client.registerApp(
            id,
            secret,
            object : TtsConnectionListener {
              override fun onConnected() {
                if (cont.isActive) cont.resume(Unit)
              }

              override fun onFailed(error: TtsError) {
                if (cont.isActive) cont.resumeWithException(PleosServiceException("음성 안내 앱 등록 실패: $error"))
              }
            },
          )
        }
      }
    } catch (e: Throwable) {
      client.release()
      throw e
    }
    client.setLocale(Locale.KOREA)
    return client.also { tts = it }
  }

  private companion object {
    const val LISTEN_TIMEOUT_MS = 15_000L
  }
}
