package ai.mobi.pleosconnect

import ai.pleos.playground.navi.data.DestinationArrivedInfo
import ai.pleos.playground.navi.helper.NaviHelper
import ai.pleos.playground.navi.helper.listener.NaviHelperEventListener
import android.content.Context

// 목적지 도착 알림만 받는다. 장거리 주행이 끝난 시점에 착좌감을 묻기 위해서다.
// 내비 서비스가 없는 환경에서는 알림 없이 조용히 동작한다 (기어 P 전환으로도 주행 종료를 감지한다).
class NaviEvents(
  context: Context,
  private val onArrived: () -> Unit,
) {
  private val navi = NaviHelper(context)
  private var started = false

  private val listener =
    object : NaviHelperEventListener {
      override fun onDestinationArrived(info: DestinationArrivedInfo) = onArrived()
    }

  fun start() {
    if (started) return
    started = true
    navi.initialize({ navi.addListener(listener) }, { _: Throwable? -> started = false })
  }

  fun stop() {
    if (!started) return
    navi.removeListener(listener)
    navi.release()
    started = false
  }
}
