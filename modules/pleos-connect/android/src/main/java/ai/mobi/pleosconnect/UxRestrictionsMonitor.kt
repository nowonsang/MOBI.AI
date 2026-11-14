package ai.mobi.pleosconnect

import android.car.Car
import android.car.drivingstate.CarUxRestrictions
import android.car.drivingstate.CarUxRestrictionsManager
import android.content.Context

// Pleos 주행 규제 가이드: 앱은 플랫폼이 주는 CarUxRestrictions 를 기준으로 주행 중 UX 를 줄인다.
// 시트·차량 설정은 UX_RESTRICTIONS_NO_SETUP 대상이다. 시트를 실제로 움직이기 전의 기어 P 확인(DriverSeat)은 그대로 둔다.
// 일반 Android 기기에는 android.car 클래스가 없다. 이 클래스는 차량(FEATURE_AUTOMOTIVE)에서만 만든다 (PleosConnectModule).
class UxRestrictionsMonitor(
  context: Context,
  private val onChanged: (Map<String, Boolean>) -> Unit,
) {
  @Volatile
  private var observing = false

  private val listener =
    CarUxRestrictionsManager.OnUxRestrictionsChangedListener { onChanged(toJs(it)) }

  // 차량 서비스에 연결되지 않은 동안은 제한 상태를 모른다: 막혀 있다고 알린다 (toJs(null)).
  private val connection: CarConnection<CarUxRestrictionsManager> =
    CarConnection(
      context,
      Car.CAR_UX_RESTRICTION_SERVICE,
      CarUxRestrictionsManager::class.java,
      onConnected = {
        if (observing) runCatching { register() }
        runCatching { onChanged(current()) }
      },
      onLost = { onChanged(toJs(null)) },
    )

  fun current(): Map<String, Boolean> = toJs(connection.manager().currentCarUxRestrictions)

  @Synchronized
  fun startObserving() {
    if (observing) return
    // 아직 연결되지 않았으면 연결되는 순간(onConnected) 등록한다.
    observing = true
    runCatching { register() }
  }

  @Synchronized
  fun stopObserving() {
    if (!observing) return
    connection.currentOrNull()?.let { runCatching { it.unregisterListener() } }
    observing = false
  }

  private fun register() {
    connection.manager().registerListener(listener)
  }

  fun release() {
    stopObserving()
    connection.disconnect()
  }

  private fun toJs(value: CarUxRestrictions?): Map<String, Boolean> {
    // 값을 받지 못하면 막혀 있다고 본다 (안전 쪽으로 실패).
    if (value == null) return mapOf("requiresDistractionOptimization" to true, "noSetup" to true)
    return mapOf(
      "requiresDistractionOptimization" to value.isRequiresDistractionOptimization,
      "noSetup" to (value.activeRestrictions and CarUxRestrictions.UX_RESTRICTIONS_NO_SETUP != 0),
    )
  }
}
