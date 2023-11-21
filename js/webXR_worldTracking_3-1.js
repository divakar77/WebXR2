import * as THREE from "https://cdn.skypack.dev/three@0.134.0";
import { OrbitControls } from "https://cdn.skypack.dev/three@0.134.0/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "https://cdn.skypack.dev/three@0.134.0/examples/jsm/loaders/GLTFLoader.js";

const MAX_OBJECTS = 1;
let objects = [];
let oldClientX, oldClientY, oldDistance, initialTouchX, initialTouchY;
let objectClone, actualObject;

async function activateAR() {
  const canvas = document.createElement("canvas");
  document.body.appendChild(canvas);
  const gl = canvas.getContext("webgl", { xrCompatible: true });

  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    preserveDrawingBuffer: true,
    canvas: canvas,
    context: gl,
  });
  //renderer.shadowMap.enabled = true;
  //renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.autoClear = false;
  renderer.outputEncoding = THREE.sRGBEncoding;

  const scene = new THREE.Scene();

  const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
  directionalLight.position.set(-2, 2, 0);
  directionalLight.castShadow = true;
  directionalLight.receiveShadow = false;
  scene.add(directionalLight);

  /*directionalLight.shadow.mapSize.width = 512;
  directionalLight.shadow.mapSize.height = 512;
  directionalLight.shadow.camera.near = 0.1;
  directionalLight.shadow.camera.near = 500;
  directionalLight.shadow.focus = 1;*/

  const planeGeometry = new THREE.PlaneGeometry(1, 1);
  planeGeometry.rotateX(-Math.PI / 2);

  const planeMaterial = new THREE.MeshStandardMaterial({
    color: 0xeedddd,
    transparent: true,
    opacity: 0.5,
  });

  const shadowPlane = new THREE.Mesh(planeGeometry, planeMaterial);
  shadowPlane.castShadow = false;
  shadowPlane.receiveShadow = true;
  shadowPlane.position.y = 10000;
  scene.add(shadowPlane);

  const camera = new THREE.PerspectiveCamera();
  camera.matrixAutoUpdate = false;

  const session = await navigator.xr.requestSession("immersive-ar", {
    requiredFeatures: ["hit-test", "dom-overlay", "light-estimation", "depth-sensing"],
    depthSensing: {
      usagePreference: ["cpu-optimized", "gpu-optimized"],
      dataFormatPreference: ["luminance-alpha", "float32"],
    },
    domOverlay: { root: document.body },
  });
  session.updateRenderState({
    baseLayer: new XRWebGLLayer(session, gl),
  });

  const referenceSpace = await session.requestReferenceSpace("local");
  const viewerSpace = await session.requestReferenceSpace("viewer");
  const hitTestSource = await session.requestHitTestSource({
    space: viewerSpace,
  });
  const lightProbe = await session.requestLightProbe();

  document.querySelector("#depth-info").innerHTML = `depth-usage: ${session.depthUsage} & depth Data Format: ${session.depthDataFormat}`;

  const loader = new GLTFLoader();
  let reticle;
  loader.load("https://immersive-web.github.io/webxr-samples/media/gltf/reticle/reticle.gltf", function (gltf) {
    reticle = gltf.scene;
    reticle.scale.set(0.4, 0.4, 0.4);
    reticle.children[2].material.color = { r: 1, g: 0, b: 0 };
    reticle.children[2].material.transparent = true;
    reticle.children[2].material.opacity = 0.1;
    reticle.visible = false;
    scene.add(reticle);
  });

  let chair;
  loader.load("https://raw.githubusercontent.com/Midnightfury/3Dmodels/main/gltfModels/office_chair/scene.gltf", function (gltf) {
    chair = gltf.scene;
    chair.scale.set(0.5, 0.5, 0.5);
    actualObject = chair;
    chair.castShadow = true;
    chair.receiveShadow = false;
  });

  let visibleReticle = true;
  const objectPlacementBtn = document.querySelector("#object-placement");
  objectPlacementBtn.addEventListener("click", (event) => {
    if (chair && visibleReticle) {
      const clone = chair.clone();
      objectClone = clone;
      clone.position.copy(reticle.position);
      scene.add(clone);

      directionalLight.target = clone;

      objects.push(clone);
      if (objects.length > MAX_OBJECTS) {
        let oldObject = objects.shift();
        scene.remove(oldObject);
      }

      shadowPlane.position.y = clone.position.y - 0.3;
      shadowPlane.position.z = clone.position.z - 1;
      shadowPlane.position.x = clone.position.x;
    }
    reticle.visible = false;
    visibleReticle = false;
  });

  const enableTrackingBtn = document.querySelector("#enable-tracking");
  enableTrackingBtn.addEventListener("click", function () {
    if (!visibleReticle) {
      visibleReticle = true;
    }
  });

  const onXRFrame = (time, frame) => {
    session.requestAnimationFrame(onXRFrame);

    gl.bindFramebuffer(gl.FRAMEBUFFER, session.renderState.baseLayer.framebuffer);

    const pose = frame.getViewerPose(referenceSpace);
    const lightEstimate = frame.getLightEstimate(lightProbe);

    document.querySelector("#content-intensity").innerHTML = `R = ${lightEstimate.primaryLightIntensity.x.toFixed(5)}, G = ${lightEstimate.primaryLightIntensity.y.toFixed(5)}, B = ${lightEstimate.primaryLightIntensity.z.toFixed(5)}, W = ${lightEstimate.primaryLightIntensity.w}`;
    document.querySelector("#content-direction").innerHTML = `X = ${lightEstimate.primaryLightDirection.x.toFixed(5)}, Y = ${lightEstimate.primaryLightDirection.y.toFixed(5)}, Z = ${lightEstimate.primaryLightDirection.z.toFixed(5)}, W = ${lightEstimate.primaryLightDirection.w}`;

    //Light intensity
    directionalLight.intensity = (0.299 * lightEstimate.primaryLightIntensity.x + 0.587 * lightEstimate.primaryLightIntensity.y + 0.114 * lightEstimate.primaryLightIntensity.z) / 3;
    //Light direction
    //x-direction
    if (lightEstimate.primaryLightDirection.x < 0) {
      directionalLight.position.x = -0.7 + lightEstimate.primaryLightDirection.x;
    } else {
      directionalLight.position.x = 0.7 + lightEstimate.primaryLightDirection.x;
    }
    //z-direction
    if (lightEstimate.primaryLightDirection.z < 0) {
      directionalLight.position.z = -0.3 + lightEstimate.primaryLightDirection.z;
    } else {
      directionalLight.position.z = 0.3 + lightEstimate.primaryLightDirection.z;
    }
    //y-direction
    directionalLight.position.y = 0.4 + lightEstimate.primaryLightDirection.y;

    document.querySelector("#directional-light-value").innerHTML = `Directional Light intensity: ${directionalLight.intensity.toFixed(5)}`;
    document.querySelector("#directional-light-vector3").innerHTML = `Directional Light Position: ${directionalLight.position.x.toFixed(5)}, ${directionalLight.position.y.toFixed(5)}, ${directionalLight.position.z.toFixed(5)}`;

    if (pose) {
      const view = pose.views[0];

      const depthInfo = frame.getDepthInformation(view);

      const viewport = session.renderState.baseLayer.getViewport(view);
      renderer.setSize(viewport.width, viewport.height);

      camera.matrix.fromArray(view.transform.matrix);
      camera.projectionMatrix.fromArray(view.projectionMatrix);
      camera.updateMatrixWorld(true);

      const hitTestResults = frame.getHitTestResults(hitTestSource);

      if (hitTestResults.length > 0 && visibleReticle) {
        const hitPose = hitTestResults[0].getPose(referenceSpace);

        reticle.visible = true;
        reticle.position.set(hitPose.transform.position.x, hitPose.transform.position.y, hitPose.transform.position.z);
        reticle.updateMatrixWorld(true);
      }

      if (depthInfo) {
        const depthInMeters = depthInfo.getDepthInMeters(0.5, 0.5);
        document.querySelector("#depth-in-meters").innerHTML = `Depth in Meters: ${depthInMeters.toFixed(4)}`;
        document.querySelector("#depth-info-matrix-dim").innerHTML = `Depth-info width: ${depthInfo.width}, Depth-info height: ${depthInfo.height}`;
      } else {
        document.querySelector("#depth-in-meters").innerHTML = "depth information not available from viewer pose";
        document.querySelector("#depth-info-matrix-dim").innerHTML = "depth information not available from viewer pose";
      }

      renderer.render(scene, camera);
    }

    //Rotate and Scale Events
    canvas.addEventListener("touchmove", function (evt) {
      if (evt.touches.length == 1 && VerticalHorizontalSwipe(evt) == 1) {
        TranslateObject(evt);
      } else if (evt.touches.length == 1 && VerticalHorizontalSwipe(evt) == 2) {
        RotateObject(evt);
      } else if (evt.touches.length == 2) {
        ScaleObject(evt);
      }
    });

    canvas.addEventListener("touchend", function (evt) {
      oldClientX = undefined;
      oldClientY = undefined;
      initialTouchX = undefined;
      initialTouchY = undefined;

      if (evt.touches.length < 2) {
        oldDistance = undefined;
      }
    });
  };
  session.requestAnimationFrame(onXRFrame);
}

document.querySelector("#start-ar").addEventListener("click", activateAR);

function VerticalHorizontalSwipe(evt) {
  var verticalSwipe = Math.abs(evt.touches[0].clientY - initialTouchY);
  var horizontalSwipe = Math.abs(evt.touches[0].clientX - initialTouchX);

  if (verticalSwipe > horizontalSwipe) {
    return 1;
  } else if (horizontalSwipe > verticalSwipe) {
    return 2;
  }

  initialTouchX = evt.touches[0].clientX;
  initialTouchY = evt.touches[0].clientY;
}

function RotateObject(evt) {
  var dX;

  oldClientX = oldClientX || evt.touches[0].clientX;
  dX = oldClientX - evt.touches[0].clientX;

  objectClone.rotation.y = objectClone.rotation.y - dX / 50;
  oldClientX = evt.touches[0].clientX;

  //Set actual object rotation equal to clone's
  actualObject.rotation.y = objectClone.rotation.y;
}

function ScaleObject(evt) {
  var dX, dY, distance, distanceDifference, modelScale;
  dX = evt.touches[0].clientX - evt.touches[1].clientX;
  dY = evt.touches[0].clientY - evt.touches[1].clientY;

  distance = Math.sqrt(dX * dX + dY * dY);
  oldDistance = oldDistance || distance;
  distanceDifference = oldDistance - distance;
  modelScale = objectClone.scale.x;

  modelScale -= distanceDifference / 200;

  //Clamp scale
  modelScale = Math.min(Math.max(0.3, modelScale), 2.5);

  //set new scale
  objectClone.scale.set(modelScale, modelScale, modelScale);

  //set actual object scale equal to clone's
  actualObject.scale.set(modelScale, modelScale, modelScale);

  modelScale = modelScale;
  oldDistance = distance;
}

function TranslateObject(evt) {
  var dY;

  oldClientY = oldClientY || evt.touches[0].clientY;
  dY = oldClientY - evt.touches[0].clientY;

  objectClone.position.z = objectClone.position.z - dY / 150;
  oldClientY = evt.touches[0].clientY;
}
