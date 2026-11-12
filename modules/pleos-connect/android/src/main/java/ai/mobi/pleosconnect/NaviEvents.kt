package ai.mobi.pleosconnect

import ai.pleos.playground.navi.data.DestinationArrivedInfo
import ai.pleos.playground.navi.data.DestinationInfo
import ai.pleos.playground.navi.helper.NaviHelper
import ai.pleos.playground.navi.helper.listener.NaviHelperEventListener
import android.content.Context
import kotlin.coroutines.resume
import kotlinx.coroutines.CancellableContinuation
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withTimeoutOrNull

// 목적지 도착 알림을 받고, 목적지까지 남은 거리·시간을 읽는다.
// 도착 알림은 장거리 주행이 끝난 시점에 착좌감을 묻기 위해서, 남은 거리·시간은 주차 중에 운전 상황(장거리·시내)을 제안하기 위해서다.
// 내비 서비스가 없는 환경에서는 알림 없이 조용히 동작한다 (기어 P 전환으로도 주행 종료를 감지한다).
// NaviHelper 가이드: release() 한 객체는 다시 쓰지 않는다. 다시 시작할 때마다 새로 만들고 초기화한다.
class NaviEvents(
  private val context: Context,
  private val onArrived: () -> Unit,
) {
  private var navi: NaviHelper? = null
  private var connected = false

  // 연결 결과를 기다리는 곳. start() 마다 새로 만들고, 연결되면 true, 실패하거나 stop() 되면 false 로 끝난다.
  private var connection: CompletableDeferred<Boolean>? = null

  // getDestinationInfo() 는 값을 돌려주지 않고 onDestinationInfo 콜백으로 알려 준다. 그 콜백을 기다리는 호출들.
  private val routeWaiters = mutableListOf<CancellableContinuation<Map<String, Int>?>>()

  private val listener =
    object : NaviHelperEventListener {
      override fun onDestinationArrived(info: DestinationArrivedInfo) = onArrived()

      override fun onDestinationInfo(info: DestinationInfo) = onRoute(info)
    }

  /**
   * 목적지까지 남은 거리·시간(SDK 원시 값). 목적지가 없거나 내비 서비스가 답하지 않으면 null.
   * 좌표·이름·주소는 꺼내지 않는다 (개인정보: 거리·시간 값만 그 순간에 쓴다).
   * 권한: NAVI_ROUTE (NaviHelper.getDestinationInfo 의 @RequiresPermission).
   */
  suspend fun readRoute(): Map<String, Int>? {
    start()
    val pending = synchronized(this) { connection } ?: return null
    if (withTimeoutOrNull(CONNECT_TIMEOUT_MS) { pending.await() } != true) return null
    // 목적지가 없을 때 콜백이 오는지는 문서에 없다. 오지 않으면 목적지가 없는 것으로 본다.
    return withTimeoutOrNull(READ_TIMEOUT_MS) {
      suspendCancellableCoroutine { cont ->
        val helper =
          synchronized(this@NaviEvents) {
            navi?.takeIf { connected }?.also { routeWaiters += cont }
          }
        if (helper == null) {
          cont.resume(null)
          return@suspendCancellableCoroutine
        }
        cont.invokeOnCancellation { synchronized(this@NaviEvents) { routeWaiters -= cont } }
        // 권한이 없거나 서비스가 끊겼으면 예외가 날 수 있다. 제안은 없어도 되는 기능이라 조용히 넘어간다.
        runCatching { helper.getDestinationInfo() }.onFailure { resumeRouteWaiters(null) }
      }
    }
  }

  private fun onRoute(info: DestinationInfo) {
    val distance = info.remainDistance
    val time = info.remainTime
    resumeRouteWaiters(
      if (distance > 0 && time >= 0) mapOf("remainDistance" to distance, "remainTime" to time) else null,
    )
  }

  private fun resumeRouteWaiters(route: Map<String, Int>?) {
    val waiters = synchronized(this) { routeWaiters.toList().also { routeWaiters.clear() } }
    waiters.forEach { if (it.isActive) it.resume(route) }
  }

  @Synchronized
  fun start() {
    if (navi != null) return
    val helper = NaviHelper(context)
    navi = helper
    connection = CompletableDeferred()
    helper.initialize(
      { onConnected(helper) },
      { _: Throwable? -> onFailed(helper) },
    )
  }

  @Synchronized
  fun stop() {
    val helper = navi ?: return
    if (connected) helper.removeListener(listener)
    helper.release()
    navi = null
    connected = false
    connection?.complete(false)
    connection = null
  }

  // 연결되기 전에 stop() 된 객체의 콜백은 무시한다 (이미 해제된 객체에 리스너를 붙이지 않는다).
  @Synchronized
  private fun onConnected(helper: NaviHelper) {
    if (navi !== helper) return
    helper.addListener(listener)
    connected = true
    connection?.complete(true)
  }

  @Synchronized
  private fun onFailed(helper: NaviHelper) {
    if (navi !== helper) return
    helper.release()
    navi = null
    connection?.complete(false)
    connection = null
  }

  private companion object {
    const val CONNECT_TIMEOUT_MS = 3_000L
    const val READ_TIMEOUT_MS = 2_000L
  }
}
