package ai.mobi.pleosconnect

import ai.pleos.playground.navi.data.DestinationArrivedInfo
import ai.pleos.playground.navi.helper.NaviHelper
import ai.pleos.playground.navi.helper.listener.NaviHelperEventListener
import android.content.Context

// 목적지 도착 알림만 받는다. 장거리 주행이 끝난 시점에 착좌감을 묻기 위해서다.
// 내비 서비스가 없는 환경에서는 알림 없이 조용히 동작한다 (기어 P 전환으로도 주행 종료를 감지한다).
// NaviHelper 가이드: release() 한 객체는 다시 쓰지 않는다. 다시 시작할 때마다 새로 만들고 초기화한다.
class NaviEvents(
  private val context: Context,
  private val onArrived: () -> Unit,
) {
  private var navi: NaviHelper? = null
  private var connected = false

  private val listener =
    object : NaviHelperEventListener {
      override fun onDestinationArrived(info: DestinationArrivedInfo) = onArrived()
    }

  @Synchronized
  fun start() {
    if (navi != null) return
    val helper = NaviHelper(context)
    navi = helper
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
  }

  // 연결되기 전에 stop() 된 객체의 콜백은 무시한다 (이미 해제된 객체에 리스너를 붙이지 않는다).
  @Synchronized
  private fun onConnected(helper: NaviHelper) {
    if (navi !== helper) return
    helper.addListener(listener)
    connected = true
  }

  @Synchronized
  private fun onFailed(helper: NaviHelper) {
    if (navi !== helper) return
    helper.release()
    navi = null
  }
}
