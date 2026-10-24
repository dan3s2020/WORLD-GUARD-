import * as THREE from "three";
import {
  EARTH_RADIUS,
  clamp,
  coordinates,
  terrainAt,
  wrapLongitude,
} from "./sim/planet-world.mjs";
const UP = new THREE.Vector3(0, 1, 0),
  RAD = Math.PI / 180;
export function createExplorer(
  canvas,
  camera,
  { vector, distance, onZoom, onPick, ground, solid, followTarget, spawnWalk },
) {
  let mode = "orbit",
    zoom = 0.59,
    targetZoom = 0.59,
    lat = 44.3,
    lon = 23.8,
    altitude = 35,
    yaw = 0.6,
    pitch = -0.2,
    polar = 0.78;
  let target = vector(lat, lon),
    tracking = false,
    velocity = 0,
    disposed = false;
  const eye = vector(lat, lon, EARTH_RADIUS + altitude),
    keys = new Set(),
    pointers = new Map();
  const input = { x: 0, z: 0, y: 0 },
    rotation = new THREE.Quaternion(),
    mouse = new THREE.Vector2();
  let pointerStart = null,
    pinch = null,
    dragged = false;
  function setZoom(value, { immediate = false } = {}) {
    const v = clamp(value, 0, 1);
    if (mode !== "orbit") {
      const c = coordinates(eye.x, eye.y, eye.z);
      target = vector(c.lat, c.lon, EARTH_RADIUS + ground(c.lat, c.lon));
      mode = "orbit";
      tracking = false;
    }
    targetZoom = v;
    if (immediate) zoom = v;
    onZoom?.(v);
  }
  function focus(point, value = 0.59) {
    target.copy(point);
    const g = coordinates(point.x, point.y, point.z);
    lat = g.lat;
    lon = g.lon;
    mode = "orbit";
    setZoom(value);
  }
  function travel(a, b, value = 0.59) {
    if (![a, b].every(Number.isFinite) || Math.abs(a) > 90)
      throw Error("Use latitude −90…90 and longitude −180…180.");
    tracking = false;
    lat = clamp(a, -89.99, 89.99);
    lon = wrapLongitude(b);
    focus(vector(lat, lon, EARTH_RADIUS + terrainAt(lat, lon).height), value);
  }
  function setMode(value) {
    if (!["orbit", "fly", "walk"].includes(value)) return;
    clearInput();
    if (value === mode) return;
    const current = coordinates(
      camera.position.x,
      camera.position.y,
      camera.position.z,
    );
    if (value === "orbit") {
      const g = coordinates(eye.x, eye.y, eye.z);
      focus(vector(g.lat, g.lon, EARTH_RADIUS + ground(g.lat, g.lon)), 0.59);
      return;
    }
    if (mode === "orbit") {
      const p = coordinates(target.x, target.y, target.z);
      lat = p.lat;
      lon = p.lon;
      const minimum = ground(lat, lon);
      altitude =
        value === "walk"
          ? minimum + 1.72
          : Math.max(
              minimum + 7,
              Math.min(80, distance(zoom, camera.aspect) * 0.45),
            );
      eye.copy(vector(lat, lon, EARTH_RADIUS + altitude));
      yaw += Math.PI;
      pitch = value === "walk" ? -0.08 : -0.22;
      if (value === "walk") {
        const spawn = spawnWalk?.(lat, lon);
        if (spawn) {
          eye.copy(spawn);
          yaw = 0;
        }
      }
      if (value === "walk" && solid(eye, 1.72)) {
        // Descend onto a nearby clear spot rather than into a wall or placed block.
        rotation.setFromUnitVectors(UP, vector(lat, lon, 1));
        for (let i = 1; i <= 30; i++) {
          const candidate = eye
            .clone()
            .add(
              new THREE.Vector3(
                Math.cos(i * 2.4) * i,
                0,
                Math.sin(i * 2.4) * i,
              ).applyQuaternion(rotation),
            );
          const g = coordinates(candidate.x, candidate.y, candidate.z);
          candidate
            .normalize()
            .multiplyScalar(EARTH_RADIUS + ground(g.lat, g.lon) + 1.72);
          if (!solid(candidate, 1.72)) {
            eye.copy(candidate);
            break;
          }
        }
      }
    } else if (value === "walk") {
      lat = current.lat;
      lon = current.lon;
      eye.copy(vector(lat, lon, EARTH_RADIUS + ground(lat, lon) + 1.72));
    }
    mode = value;
    tracking = false;
    velocity = 0;
  }
  function clearInput() {
    keys.clear();
    input.x = input.y = input.z = 0;
  }
  function jump() {
    if (mode !== "walk") return;
    const geo = coordinates(eye.x, eye.y, eye.z);
    if (
      eye.length() - EARTH_RADIUS <= ground(geo.lat, geo.lon) + 1.8 &&
      velocity <= 0
    )
      velocity = 10;
  }
  function rotate(x, y) {
    yaw += x;
    if (mode === "orbit") polar = clamp(polar + y, 0.05, 1.5);
    else pitch = clamp(pitch - y, -1.48, 1.48);
  }
  function update(dt) {
    if (disposed) return;
    dt = Math.min(0.1, dt);
    zoom += (targetZoom - zoom) * (1 - Math.exp(-dt * 9));
    if (mode === "orbit") {
      const tracked = tracking ? followTarget(zoom) : null;
      if (tracked) target.copy(tracked);
      const geo = coordinates(target.x, target.y, target.z);
      lat = geo.lat;
      lon = geo.lon;
      rotation.setFromUnitVectors(UP, vector(lat, lon, 1));
      const blend = clamp(zoom / 0.32, 0, 1),
        look = target.clone().multiplyScalar(blend * blend * (3 - 2 * blend));
      // At orbital scale the camera faces the geographic point, not the local horizon.
      const offset =
        zoom < 0.32
          ? vector(lat, lon, 1)
          : new THREE.Vector3(
              Math.sin(yaw) * Math.sin(polar),
              Math.cos(polar),
              Math.cos(yaw) * Math.sin(polar),
            ).applyQuaternion(rotation);
      camera.position
        .copy(look)
        .addScaledVector(offset, distance(zoom, camera.aspect));
      camera.up.copy(vector(lat, lon, 1));
      camera.lookAt(look);
      eye.copy(camera.position);
      altitude = camera.position.length() - EARTH_RADIUS;
    } else {
      const geo = coordinates(eye.x, eye.y, eye.z);
      lat = geo.lat;
      lon = geo.lon;
      rotation.setFromUnitVectors(UP, vector(lat, lon, 1));
      const forward = new THREE.Vector3(
          Math.sin(yaw),
          0,
          Math.cos(yaw),
        ).applyQuaternion(rotation),
        right = new THREE.Vector3(
          -Math.cos(yaw),
          0,
          Math.sin(yaw),
        ).applyQuaternion(rotation);
      let z =
          input.z +
          (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0) -
          (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0),
        x = input.x + (keys.has("KeyD") ? 1 : 0) - (keys.has("KeyA") ? 1 : 0);
      const length = Math.hypot(x, z);
      if (length > 1) {
        x /= length;
        z /= length;
      }
      if (keys.has("ArrowLeft")) yaw += dt * 1.5;
      if (keys.has("ArrowRight")) yaw -= dt * 1.5;
      const speed =
        mode === "walk"
          ? keys.has("ShiftLeft")
            ? 9
            : 5
          : clamp(Math.max(altitude, 5) * 0.65, 8, 2200) *
            (keys.has("ShiftLeft") ? 3 : 1);
      const movement = forward
        .multiplyScalar(z * speed * dt)
        .addScaledVector(right, x * speed * dt);
      const oldAltitude = eye.length() - EARTH_RADIUS;
      if (mode === "walk") {
        const steps = Math.max(1, Math.ceil(movement.length() / 0.22)),
          increment = movement.multiplyScalar(1 / steps);
        for (let i = 0; i < steps; i++) {
          const next = eye.clone().add(increment),
            g = coordinates(next.x, next.y, next.z),
            floor = ground(g.lat, g.lon);
          const h = eye.length() - EARTH_RADIUS;
          next
            .normalize()
            .multiplyScalar(EARTH_RADIUS + Math.max(h, floor + 1.72));
          if (floor + 1.72 - h < 0.65 && !solid(next, 1.72)) eye.copy(next);
        }
        const g = coordinates(eye.x, eye.y, eye.z),
          floor = ground(g.lat, g.lon) + 1.72;
        const h = eye.length() - EARTH_RADIUS;
        velocity -= 20 * dt;
        const nextH = Math.max(floor, h + velocity * dt);
        if (nextH <= floor + 0.001 && velocity <= 0) velocity = 0;
        eye.normalize().multiplyScalar(EARTH_RADIUS + nextH);
      } else {
        eye.add(movement);
        const g = coordinates(eye.x, eye.y, eye.z);
        const vertical =
          input.y +
          (keys.has("Space") || keys.has("KeyE") ? 1 : 0) -
          (keys.has("KeyQ") || keys.has("ControlLeft") ? 1 : 0);
        eye
          .normalize()
          .multiplyScalar(
            EARTH_RADIUS +
              clamp(
                oldAltitude + vertical * speed * dt,
                ground(g.lat, g.lon) + 2,
                40000,
              ),
          );
      }
      const g = coordinates(eye.x, eye.y, eye.z);
      lat = g.lat;
      lon = g.lon;
      altitude = eye.length() - EARTH_RADIUS;
      rotation.setFromUnitVectors(UP, vector(lat, lon, 1));
      camera.position.copy(eye);
      camera.up.copy(vector(lat, lon, 1));
      const look = new THREE.Vector3(
        Math.sin(yaw) * Math.cos(pitch),
        Math.sin(pitch),
        Math.cos(yaw) * Math.cos(pitch),
      )
        .applyQuaternion(rotation)
        .add(eye);
      camera.lookAt(look);
    }
    camera.near = altitude > 1000 ? 0.5 : 0.025;
    camera.far = Math.max(60000, camera.position.length() + EARTH_RADIUS * 4);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
  }
  const handlers = {
    pointerdown(e) {
      canvas.focus({ preventScroll: true });
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      canvas.setPointerCapture(e.pointerId);
      if (pointers.size === 1) {
        pointerStart = {
          x: e.clientX,
          y: e.clientY,
          yaw,
          polar,
          pitch,
          lat,
          lon,
        };
        dragged = false;
      } else if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinch = {
          distance: Math.hypot(a.x - b.x, a.y - b.y),
          zoom: targetZoom,
        };
        dragged = true;
      }
    },
    pointermove(e) {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2 && pinch) {
        const [a, b] = [...pointers.values()];
        setZoom(
          pinch.zoom +
            Math.log(
              Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)) /
                Math.max(1, pinch.distance),
            ) *
              0.18,
        );
      } else if (pointerStart && pointers.size === 1) {
        const dx = e.clientX - pointerStart.x,
          dy = e.clientY - pointerStart.y;
        if (Math.hypot(dx, dy) > 5) dragged = true;
        if (mode === "orbit" && zoom < 0.36) {
          lat = clamp(pointerStart.lat + dy * 0.2, -89.99, 89.99);
          lon = wrapLongitude(pointerStart.lon - dx * 0.25);
          tracking = false;
          target.copy(
            vector(lat, lon, EARTH_RADIUS + terrainAt(lat, lon).height),
          );
        } else {
          yaw = pointerStart.yaw - dx * 0.005;
          if (mode === "orbit")
            polar = clamp(pointerStart.polar + dy * 0.005, 0.05, 1.5);
          else pitch = clamp(pointerStart.pitch - dy * 0.004, -1.48, 1.48);
        }
      }
    },
    pointerup(e) {
      const click = pointers.size === 1 && !dragged;
      pointers.delete(e.pointerId);
      pointerStart = null;
      pinch = null;
      if (click) {
        const r = canvas.getBoundingClientRect();
        mouse.set(
          ((e.clientX - r.left) / r.width) * 2 - 1,
          (-(e.clientY - r.top) / r.height) * 2 + 1,
        );
        onPick?.(mouse, mode);
      }
    },
    pointercancel() {
      pointers.clear();
      pointerStart = null;
      pinch = null;
    },
    wheel(e) {
      e.preventDefault();
      setZoom(targetZoom - e.deltaY * 0.0004);
    },
    keydown(e) {
      if (e.isComposing) return;
      if (
        [
          "Space",
          "ArrowUp",
          "ArrowDown",
          "ArrowLeft",
          "ArrowRight",
          "Home",
          "End",
          "Equal",
          "Minus",
        ].includes(e.code)
      )
        e.preventDefault();
      keys.add(e.code);
      if (e.code === "Space") jump();
      if (e.key === "Home") setZoom(0);
      if (e.key === "End") setZoom(1);
      if (e.key === "+" || e.key === "=") setZoom(targetZoom + 0.04);
      if (e.key === "-") setZoom(targetZoom - 0.04);
      if (mode === "orbit") {
        if (e.key === "ArrowLeft") rotate(-0.12, 0);
        if (e.key === "ArrowRight") rotate(0.12, 0);
        if (e.key === "ArrowUp") rotate(0, -0.1);
        if (e.key === "ArrowDown") rotate(0, 0.1);
      }
    },
    keyup(e) {
      keys.delete(e.code);
    },
    blur() {
      clearInput();
    },
    contextmenu(e) {
      e.preventDefault();
    },
  };
  for (const [n, h] of Object.entries(handlers))
    canvas.addEventListener(
      n,
      h,
      n === "wheel" ? { passive: false } : undefined,
    );
  window.addEventListener("blur", clearInput);
  document.addEventListener("visibilitychange", clearInput);
  return {
    update,
    setZoom,
    zoom: () => targetZoom,
    focus,
    travel,
    setMode,
    jump,
    rotate,
    clearInput,
    setFollow(value) {
      tracking = !!value;
    },
    setMove(x, z, y = 0) {
      if (mode === "orbit" && (x || z || y)) setMode("fly");
      input.x = clamp(x, -1, 1);
      input.z = clamp(z, -1, 1);
      input.y = clamp(y, -1, 1);
    },
    exportState: () => ({
      mode,
      lat,
      lon,
      altitude: Math.max(0, altitude),
      yaw,
      pitch,
      polar,
      zoom: targetZoom,
      targetHeight: target.length() - EARTH_RADIUS,
    }),
    restore(s) {
      if (!s) return;
      travel(s.lat, s.lon, s.zoom);
      target.copy(vector(s.lat, s.lon, EARTH_RADIUS + (s.targetHeight || 0)));
      yaw = s.yaw;
      pitch = s.pitch;
      polar = s.polar ?? 0.78;
      if (s.mode !== "orbit") {
        mode = s.mode;
        altitude = s.altitude;
        eye.copy(vector(s.lat, s.lon, EARTH_RADIUS + altitude));
      }
      zoom = targetZoom;
    },
    state: () => ({
      mode,
      lat,
      lon,
      altitude,
      zoom,
      targetZoom,
      tracking,
      verticalVelocity: velocity,
      target: target.toArray(),
      position: camera.position.toArray(),
      distance: mode === "orbit" ? distance(zoom, camera.aspect) : altitude,
      level:
        mode !== "orbit"
          ? mode
          : zoom < 0.36
            ? "planet"
            : zoom < 0.75
              ? "city"
              : zoom < 0.86
                ? "building"
                : zoom < 0.96
                  ? "apartment"
                  : "agent",
    }),
    dispose() {
      disposed = true;
      for (const [n, h] of Object.entries(handlers))
        canvas.removeEventListener(n, h);
      window.removeEventListener("blur", clearInput);
      document.removeEventListener("visibilitychange", clearInput);
    },
  };
}
