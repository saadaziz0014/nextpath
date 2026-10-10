export const DRIVING_CAMERA_ZOOM = 16.5;
export const DRIVING_CAMERA_PITCH = 50;

export function drivingCameraOptions(input: {
  position: [number, number]; bearing: number; padding: ReturnType<typeof drivingCameraPadding>;
  recenter: boolean; zooming: boolean; now: number; zoomIntentUntil: number;
}) {
  if (!input.recenter && (input.zooming || input.now < input.zoomIntentUntil)) return null;
  return { center: input.position, bearing: input.bearing, pitch: DRIVING_CAMERA_PITCH, padding: input.padding, ...(input.recenter ? { zoom: DRIVING_CAMERA_ZOOM } : {}) };
}

export function vehicleScreenHeading(vehicleHeading: number, cameraBearing: number) {
  return ((vehicleHeading - cameraBearing + 540) % 360 + 360) % 360 - 180;
}

export interface CameraViewport {
  width: number;
  height: number;
  controlsTop: number;
  controlsRight: number;
  plannerBottom: number;
}

/** Keep the car below the centre of the unobstructed map, leaving road ahead. */
export function drivingCameraPadding(view: CameraViewport) {
  const width = Math.max(1, view.width), height = Math.max(1, view.height);
  const mobile = width < 640;
  const bottom = mobile ? Math.min(Math.max(0, height - view.controlsTop + 40), Math.max(0, height - 96)) : Math.min(40, height * .1);
  const safeTop = mobile ? Math.min(Math.max(20, view.plannerBottom + 20), Math.max(0, height - bottom - 96)) : Math.min(80, height * .15);
  const top = safeTop;
  const left = mobile ? Math.min(16, width * .05) : Math.min(view.controlsRight + 40, width * .55);
  const right = Math.min(mobile ? 16 : 48, width * .1);
  return { top, bottom, left, right };
}
