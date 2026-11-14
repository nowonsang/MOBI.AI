package ai.mobi.pleosconnect

import android.car.Car
import android.content.Context

// Android 차량 서비스(com.android.car) 연결 하나와 그 서비스의 매니저 하나.
// Car.createCar(context) 처럼 수명 리스너 없이 연결하면, 차량 서비스가 죽었다 다시 뜰 때 Car 라이브러리가 앱 프로세스를
// 강제로 끝낸다 ("Car service has crashed. Client(null) is not handling it"). 시트가 움직이는 중이었다면 앱이 STOP 을
// 보내지 못한 채 사라진다. 그래서 리스너를 달아 앱을 살려 두고, 연결되지 않은 동안은 값을 모르는 것으로 본다(안전 쪽으로 실패).
// 연결은 늦게 될 수도 있고(앱 시작 때 차량 서비스가 아직 준비되지 않음) 끊겼다 다시 될 수도 있다. 둘 다 연결된 순간
// onConnected 로 알려, 구독을 (다시) 등록하고 현재 값을 다시 보내게 한다. 끊기기 전에 받은 매니저는 쓸 수 없어 새로 받는다.
internal class CarConnection<T : Any>(
  context: Context,
  private val serviceName: String,
  private val type: Class<T>,
  // 연결되지 않았다가 연결됐을 때 (메인 스레드).
  private val onConnected: () -> Unit,
  // 연결이 끊겼을 때 (메인 스레드).
  private val onLost: () -> Unit,
) {
  private var manager: T? = null
  private var connected = false

  // 처음 연결은 짧게만 기다린다. 늦어지면 연결되는 순간 onConnected 가 불린다.
  private val car: Car = Car.createCar(context, null, CONNECT_TIMEOUT_MS) { _, ready -> onLifecycleChanged(ready) }

  init {
    synchronized(this) { if (car.isConnected) connected = true }
  }

  /** 연결된 동안의 매니저. 연결되지 않았으면 예외를 던진다 (부르는 쪽이 "모름"으로 처리한다). */
  @Synchronized
  fun manager(): T {
    manager?.let { return it }
    if (!car.isConnected) throw PleosServiceException("차량 서비스에 연결되어 있지 않습니다")
    val service = car.getCarManager(serviceName) ?: throw PleosServiceException("차량 서비스를 찾지 못했습니다: $serviceName")
    return type.cast(service)!!.also { manager = it }
  }

  /** 이미 받은 매니저. 없으면 null (콜백 해제처럼 새로 연결할 필요가 없는 곳에서 쓴다). */
  @Synchronized
  fun currentOrNull(): T? = manager

  fun disconnect() {
    synchronized(this) {
      manager = null
      connected = false
    }
    runCatching { car.disconnect() }
  }

  private fun onLifecycleChanged(ready: Boolean) {
    val wasConnected =
      synchronized(this) {
        val before = connected
        connected = ready
        if (before != ready) manager = null
        before
      }
    if (ready && !wasConnected) onConnected()
    if (!ready && wasConnected) onLost()
  }

  private companion object {
    const val CONNECT_TIMEOUT_MS = 1_000L
  }
}
