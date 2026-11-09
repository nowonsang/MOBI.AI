package ai.mobi.pleosconnect

import android.car.Car
import android.car.drivingstate.CarUxRestrictions
import android.car.drivingstate.CarUxRestrictionsManager
import android.content.Context

// Pleos 주행 규제 가이드: 앱은 플랫폼이 주는 CarUxRestrictions 를 기준으로 주행 중 UX 를 줄인다.
// 시트·차량 설정은 UX_RESTRICTIONS_NO_SETUP 대상이다. 시트를 실제로 움직이기 전의 기어 P 확인(DriverSeat)은 그대로 둔다.
// 일반 Android 기기에는 android.car 클래스가 없다. 이 클래스는 차량(FEATURE_AUTOMOTIVE)에서만 만든다 (PleosConnectModule).
class UxRestrictionsMonitor(
  private val context: Context,
  private val onChanged: (Map<String, Boolean>) -> Unit,
) {
  private var car: Car? = null
  private var restrictions: CarUxRestrictionsManager? = null
  private var observing = false

  private val listener =
    CarUxRestrictionsManager.OnUxRestrictionsChangedListener { onChanged(toJs(it)) }

  @Synchronized
  private fun manager(): CarUxRestrictionsManager {
    restrictions?.let { return it }
    val connected = Car.createCar(context) ?: throw NotAutomotiveException()
    car = connected
    return (connected.getCarManager(Car.CAR_UX_RESTRICTION_SERVICE) as CarUxRestrictionsManager)
      .also { restrictions = it }
  }

  fun current(): Map<String, Boolean> = toJs(manager().currentCarUxRestrictions)

  @Synchronized
  fun startObserving() {
    if (observing) return
    manager().registerListener(listener)
    observing = true
  }

  @Synchronized
  fun stopObserving() {
    if (!observing) return
    restrictions?.unregisterListener()
    observing = false
  }

  fun release() {
    stopObserving()
    car?.disconnect()
    car = null
    restrictions = null
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
