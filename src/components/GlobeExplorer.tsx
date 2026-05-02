import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { SuperWingsLocation } from "../types";

type GlobeExplorerProps = {
  locations: SuperWingsLocation[];
  selectedLocationId: string;
  onSelectLocation: (id: string) => void;
};

type MarkerObjects = {
  marker: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>;
  markerBaseScale: number;
  markerMaterial: THREE.MeshBasicMaterial;
  pulseMaterial: THREE.MeshBasicMaterial;
};

type GlobeSceneState = {
  updateSelection: (id: string) => void;
};

const earthRadius = 2.18;
const markerRadius = 0.028;
const earthTextureUrl = "/assets/earth-blue-marble-july.jpg";

export function GlobeExplorer({ locations, selectedLocationId, onSelectLocation }: GlobeExplorerProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const sceneStateRef = useRef<GlobeSceneState | null>(null);
  const selectedLocationIdRef = useRef(selectedLocationId);
  const onSelectLocationRef = useRef(onSelectLocation);

  selectedLocationIdRef.current = selectedLocationId;
  onSelectLocationRef.current = onSelectLocation;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) {
      return undefined;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(0, 0.35, 6.15);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.enableZoom = true;
    controls.enableRotate = true;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.55;
    controls.minDistance = 4.25;
    controls.maxDistance = 7.6;
    controls.rotateSpeed = 0.62;
    controls.zoomSpeed = 0.78;
    controls.touches.ONE = THREE.TOUCH.ROTATE;
    controls.touches.TWO = THREE.TOUCH.DOLLY_ROTATE;

    const rootGroup = new THREE.Group();
    rootGroup.rotation.x = -0.18;
    rootGroup.rotation.y = -0.62;
    scene.add(rootGroup);
    let focusTargetQuaternion: THREE.Quaternion | null = null;

    const markerByObjectId = new Map<number, string>();

    const ambientLight = new THREE.AmbientLight(0xb9eaff, 1.4);
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.6);
    keyLight.position.set(-2.2, 3.1, 4.4);
    scene.add(ambientLight, keyLight);

    const glow = createAtmosphere();
    scene.add(glow);

    let earthTexture: THREE.Texture | null = null;
    let isDisposed = false;
    const globe = new THREE.Mesh(
      new THREE.SphereGeometry(earthRadius, 96, 96, -Math.PI / 2),
      new THREE.MeshPhongMaterial({
        color: 0x174c79,
        emissive: 0x020d1b,
        emissiveIntensity: 0.08,
        shininess: 26,
        specular: 0x365f82,
      }),
    );
    rootGroup.add(globe);

    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(
      earthTextureUrl,
      (texture) => {
        if (isDisposed) {
          texture.dispose();
          return;
        }

        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        earthTexture = texture;

        const material = globe.material as THREE.MeshPhongMaterial;
        material.map = texture;
        material.color.set(0xffffff);
        material.emissive.set(0x010712);
        material.emissiveIntensity = 0.04;
        material.needsUpdate = true;
      },
      undefined,
      (error) => {
        console.error("Failed to load earth texture.", error);
      },
    );

    const routes = new THREE.Group();
    rootGroup.add(routes);

    const markers = new THREE.Group();
    const markerObjectsByLocationId = new Map<string, MarkerObjects>();
    for (const location of locations) {
      const point = latLngToVector3(location.coordinates.lat, location.coordinates.lng, earthRadius + 0.035);
      const markerMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.86,
        side: THREE.DoubleSide,
      });
      const marker = new THREE.Mesh(
        new THREE.CircleGeometry(markerRadius, 28),
        markerMaterial,
      );
      marker.position.copy(point);
      marker.lookAt(new THREE.Vector3(0, 0, 0));
      marker.userData.locationId = location.id;
      markerByObjectId.set(marker.id, location.id);
      markers.add(marker);

      const pulseMaterial = new THREE.MeshBasicMaterial({
        color: 0x8be9ff,
        transparent: true,
        opacity: 0.28,
        side: THREE.DoubleSide,
      });
      const pulse = new THREE.Mesh(
        new THREE.RingGeometry(markerRadius * 1.9, markerRadius * 2.3, 40),
        pulseMaterial,
      );
      pulse.position.copy(point.clone().multiplyScalar(1.001));
      pulse.lookAt(new THREE.Vector3(0, 0, 0));
      pulse.userData.locationId = location.id;
      markerByObjectId.set(pulse.id, location.id);
      markers.add(pulse);
      markerObjectsByLocationId.set(location.id, {
        marker,
        markerBaseScale: 1,
        markerMaterial,
        pulseMaterial,
      });
    }
    rootGroup.add(markers);

    const updateSelection = (id: string) => {
      const selectedLocation = locations.find((location) => location.id === id) ?? locations[0];

      for (const [locationId, markerObjects] of markerObjectsByLocationId) {
        const isSelected = locationId === selectedLocation?.id;
        markerObjects.marker.scale.setScalar(isSelected ? markerObjects.markerBaseScale * 1.18 : markerObjects.markerBaseScale);
        markerObjects.markerMaterial.color.set(isSelected ? 0xffcf4a : 0xffffff);
        markerObjects.markerMaterial.opacity = isSelected ? 0.96 : 0.82;
        markerObjects.pulseMaterial.color.set(isSelected ? 0xffcf4a : 0x8be9ff);
        markerObjects.pulseMaterial.opacity = isSelected ? 0.72 : 0.24;
      }

      disposeRouteChildren(routes);
      if (!selectedLocation) {
        return;
      }

      const selectedPoint = latLngToVector3(
        selectedLocation.coordinates.lat,
        selectedLocation.coordinates.lng,
        earthRadius,
      );
      for (const location of locations) {
        if (location.id === selectedLocation.id) {
          continue;
        }
        const target = latLngToVector3(location.coordinates.lat, location.coordinates.lng, earthRadius);
        routes.add(createRoute(selectedPoint, target));
      }

      controls.autoRotate = false;
      focusTargetQuaternion = getFocusQuaternion(selectedLocation, camera);
    };
    sceneStateRef.current = { updateSelection };
    updateSelection(selectedLocationIdRef.current);

    const labels = createLabelLayer(mount, locations, rootGroup, camera);
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const dragState = { active: false, startX: 0, startY: 0 };
    let animationFrame = 0;

    const resize = () => {
      const rect = mount.getBoundingClientRect();
      const width = Math.max(320, rect.width);
      const height = Math.max(320, rect.height);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      labels.update();
    };

    const animate = () => {
      controls.update();
      if (focusTargetQuaternion) {
        rootGroup.quaternion.slerp(focusTargetQuaternion, 0.085);
        if (rootGroup.quaternion.angleTo(focusTargetQuaternion) < 0.002) {
          rootGroup.quaternion.copy(focusTargetQuaternion);
          focusTargetQuaternion = null;
        }
      }
      routes.children.forEach((child, index) => {
        const material = (child as THREE.Line).material as THREE.LineBasicMaterial;
        material.opacity = 0.22 + Math.sin(Date.now() * 0.002 + index) * 0.08;
      });
      renderer.render(scene, camera);
      labels.update();
      animationFrame = window.requestAnimationFrame(animate);
    };

    const getPointer = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
        width: rect.width,
        height: rect.height,
      };
    };

    const handlePointerDown = (event: PointerEvent) => {
      const point = getPointer(event);
      dragState.active = true;
      dragState.startX = point.x;
      dragState.startY = point.y;
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (!dragState.active) {
        return;
      }
      const point = getPointer(event);
      const moved = Math.abs(point.x - dragState.startX) + Math.abs(point.y - dragState.startY);
      dragState.active = false;

      if (moved > 8) {
        return;
      }

      pointer.x = (point.x / point.width) * 2 - 1;
      pointer.y = -(point.y / point.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(markers.children, false)[0];
      if (hit) {
        const id = hit.object.userData.locationId ?? markerByObjectId.get(hit.object.id);
        if (typeof id === "string") {
          if (id !== selectedLocationIdRef.current) {
            onSelectLocationRef.current(id);
          }
        }
      }
    };

    resize();
    animate();
    window.addEventListener("resize", resize);
    renderer.domElement.addEventListener("pointerdown", handlePointerDown);
    renderer.domElement.addEventListener("pointerup", handlePointerUp);
    renderer.domElement.addEventListener("pointercancel", handlePointerUp);

    return () => {
      isDisposed = true;
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", resize);
      renderer.domElement.removeEventListener("pointerdown", handlePointerDown);
      renderer.domElement.removeEventListener("pointerup", handlePointerUp);
      renderer.domElement.removeEventListener("pointercancel", handlePointerUp);
      controls.dispose();
      labels.destroy();
      if (sceneStateRef.current?.updateSelection === updateSelection) {
        sceneStateRef.current = null;
      }
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
          object.geometry.dispose();
          const material = object.material;
          if (Array.isArray(material)) {
            material.forEach((item) => item.dispose());
          } else {
            material.dispose();
          }
        }
      });
      earthTexture?.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [locations]);

  useEffect(() => {
    sceneStateRef.current?.updateSelection(selectedLocationId);
  }, [selectedLocationId, locations]);

  return (
    <div className="globe-wrap" ref={mountRef}>
      <div className="globe-hud" aria-hidden="true">
        <span>拖动旋转</span>
        <span>滚轮 / 双指缩放</span>
        <span>点击地点</span>
      </div>
    </div>
  );
}

function latLngToVector3(lat: number, lng: number, radius: number) {
  const latRad = THREE.MathUtils.degToRad(lat);
  const lngRad = THREE.MathUtils.degToRad(lng);
  const cosLat = Math.cos(latRad);
  return new THREE.Vector3(
    radius * cosLat * Math.sin(lngRad),
    radius * Math.sin(latRad),
    radius * cosLat * Math.cos(lngRad),
  );
}

function getFocusQuaternion(location: SuperWingsLocation, camera: THREE.PerspectiveCamera) {
  const locationNormal = latLngToVector3(location.coordinates.lat, location.coordinates.lng, 1).normalize();
  const localNorth = getNorthTangent(location.coordinates.lat, location.coordinates.lng);
  const localEast = new THREE.Vector3().crossVectors(localNorth, locationNormal).normalize();

  const cameraNormal = camera.position.clone().normalize();
  const cameraUp = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
  let screenNorth = cameraUp.clone().projectOnPlane(cameraNormal).normalize();

  if (screenNorth.lengthSq() < 0.0001) {
    screenNorth = new THREE.Vector3(0, 1, 0).projectOnPlane(cameraNormal).normalize();
  }

  const screenEast = new THREE.Vector3().crossVectors(screenNorth, cameraNormal).normalize();
  const localBasis = new THREE.Matrix4().makeBasis(localEast, localNorth, locationNormal);
  const screenBasis = new THREE.Matrix4().makeBasis(screenEast, screenNorth, cameraNormal);
  const localQuaternion = new THREE.Quaternion().setFromRotationMatrix(localBasis);
  const screenQuaternion = new THREE.Quaternion().setFromRotationMatrix(screenBasis);

  return screenQuaternion.multiply(localQuaternion.invert());
}

function getNorthTangent(lat: number, lng: number) {
  const latRad = THREE.MathUtils.degToRad(lat);
  const lngRad = THREE.MathUtils.degToRad(lng);

  return new THREE.Vector3(
    -Math.sin(latRad) * Math.sin(lngRad),
    Math.cos(latRad),
    -Math.sin(latRad) * Math.cos(lngRad),
  ).normalize();
}

function createRoute(start: THREE.Vector3, end: THREE.Vector3) {
  const control = start.clone().add(end).multiplyScalar(0.5).normalize().multiplyScalar(earthRadius * 1.32);
  const curve = new THREE.QuadraticBezierCurve3(start, control, end);
  const geometry = new THREE.BufferGeometry().setFromPoints(curve.getPoints(42));
  return new THREE.Line(
    geometry,
    new THREE.LineBasicMaterial({
      color: 0xffd666,
      transparent: true,
      opacity: 0.28,
    }),
  );
}

function disposeRouteChildren(routes: THREE.Group) {
  for (const child of [...routes.children]) {
    routes.remove(child);
    if (child instanceof THREE.Line) {
      child.geometry.dispose();
      const material = child.material;
      if (Array.isArray(material)) {
        material.forEach((item) => item.dispose());
      } else {
        material.dispose();
      }
    }
  }
}

function createAtmosphere() {
  return new THREE.Mesh(
    new THREE.SphereGeometry(earthRadius * 1.08, 64, 64),
    new THREE.MeshBasicMaterial({
      color: 0x48c8ff,
      transparent: true,
      opacity: 0.16,
      side: THREE.BackSide,
    }),
  );
}

function createLabelLayer(
  mount: HTMLDivElement,
  locations: SuperWingsLocation[],
  globe: THREE.Group,
  camera: THREE.PerspectiveCamera,
) {
  const labels = locations.map((location) => {
    const element = document.createElement("button");
    element.className = "globe-label";
    element.type = "button";
    element.textContent = location.nameZh;
    mount.appendChild(element);
    return {
      element,
      point: latLngToVector3(location.coordinates.lat, location.coordinates.lng, earthRadius + 0.13),
    };
  });

  return {
    update() {
      const rect = mount.getBoundingClientRect();
      globe.updateWorldMatrix(true, true);
      const globeMatrix = globe.matrixWorld;
      for (const label of labels) {
        const worldPoint = label.point.clone().applyMatrix4(globeMatrix);
        const normal = worldPoint.clone().normalize();
        const cameraDirection = camera.position.clone().sub(worldPoint).normalize();
        const visible = normal.dot(cameraDirection) > 0.06;
        const projected = worldPoint.project(camera);
        const x = (projected.x * 0.5 + 0.5) * rect.width;
        const y = (-projected.y * 0.5 + 0.5) * rect.height;
        label.element.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
        label.element.style.opacity = visible ? "1" : "0";
      }
    },
    destroy() {
      labels.forEach((label) => label.element.remove());
    },
  };
}
