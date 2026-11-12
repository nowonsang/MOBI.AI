import { NativeModule, requireOptionalNativeModule } from "expo";

import type {
  DriverComfortSettings,
  DriverComfortState,
  DriverSeatState,
  Gear,
  PleosConnectEvents,
  SeatAxis,
  UxRestrictions,
} from "./PleosConnect.types";

declare class PleosConnectModule extends NativeModule<PleosConnectEvents> {
  /** Android Automotive(Pleos Connect) 기기인지. false 면 차량 기능을 쓸 수 없다. */
  isAutomotive(): boolean;
  getGear(): Promise<Gear>;
  getUxRestrictions(): Promise<UxRestrictions>;
  getDriverSeatState(): Promise<DriverSeatState>;
  /** 기어 P 에서만 움직이고, 목표에 닿거나 실패하면 멈춘 뒤 최종 위치를 돌려준다. */
  moveDriverSeatAxis(axis: SeatAxis, target: number): Promise<number>;
  stopDriverSeat(): Promise<void>;
  isDriverSeatOccupied(): Promise<boolean>;
  getDriverComfortState(): Promise<DriverComfortState>;
  /** 기어 P 에서만 바꾸고, 바꾼 뒤의 상태를 돌려준다. */
  applyDriverComfort(
    settings: DriverComfortSettings,
  ): Promise<DriverComfortState>;
  /** 한 문장을 듣고 최종 인식 결과를 돌려준다. 중간 결과는 onSpeechPartial 이벤트로 온다. */
  listen(): Promise<string>;
  stopListening(): Promise<void>;
  speak(text: string): Promise<void>;
}

// Expo Go·테스트·차량이 아닌 기기에서는 네이티브 모듈이 없으므로 null 이다.
export const PleosConnect =
  requireOptionalNativeModule<PleosConnectModule>("PleosConnect");
