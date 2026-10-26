import { Quaternion, Vector3, Euler } from './vendor/three.module.js';

export const DRIVE_TUNING=Object.freeze({speed:30,boostSpeed:48,reverseSpeed:7,acceleration:40,jumpSpeed:9.4,gravity:13.5,airThrust:23,airSpeed:62,ceiling:18});
export const CAR_PIVOT_HEIGHT=1.2;
const up=new Vector3(0,1,0),delta=new Quaternion(),axis=new Vector3(),euler=new Euler(0,0,0,'YXZ');

// The orientation is physical state: air steering applies angular velocity,
// and explosions impart angular impulses. Rotation keeps travel momentum.
export class AerialDynamics {
  constructor(){this.rotation=new Quaternion();this.angularVelocity=new Vector3();this.forward=new Vector3();this.up=new Vector3();this.bodyTop=2.57;this.halfWidth=.94;this.halfLength=1.45;this.pivotHeight=CAR_PIVOT_HEIGHT;this.reset();}
  reset(heading=0){this.rotation.setFromAxisAngle(up,heading);this.angularVelocity.set(0,0,0);this.flying=false;this.recovering=false;this.airTime=0;this.impulseTime=0;this.recoveryTime=0;this.supportLift=0;this.updateAxes();}
  takeoff(heading,pitch=0,roll=0){this.reset(heading);this.rotation.setFromEuler(euler.set(pitch,heading,roll,'YXZ'));this.flying=true;this.updateAxes();}
  updateAxes(){this.forward.set(0,0,1).applyQuaternion(this.rotation);this.up.set(0,1,0).applyQuaternion(this.rotation);}
  stepAir(dt,input={}){
    this.airTime+=dt;this.impulseTime=Math.max(0,this.impulseTime-dt);
    if(!this.impulseTime){
      const response=1-Math.exp(-5.5*dt);
      const pitch=input.forward||input.reverse?Number(!!input.forward)-Number(!!input.reverse):Math.max(-1,Math.min(1,Number(input.throttleAxis)||0));
      const yaw=input.left||input.right?Number(!!input.left)-Number(!!input.right):-Math.max(-1,Math.min(1,Number(input.steerAxis)||0));
      const targets=[pitch*3.8,yaw*2.8,0];
      for(const [i,key] of ['x','y','z'].entries())this.angularVelocity[key]+=(targets[i]-this.angularVelocity[key])*response;
    }
    const speed=this.angularVelocity.length();
    if(speed>.00001){axis.copy(this.angularVelocity).divideScalar(speed);delta.setFromAxisAngle(axis,speed*dt);this.rotation.multiply(delta).normalize();}
    this.updateAxes();
  }
  land(heading){
    this.flying=false;this.impulseTime=0;this.recoveryTime=0;
    this.recovering=this.up.y<.96||this.angularVelocity.length()>.2;
    this.landingHeading=heading;this.angularVelocity.multiplyScalar(.3);
    if(!this.recovering)this.reset(heading);
  }
  stepGround(dt,heading){
    if(!this.recovering){this.reset(heading);return;}
    this.recoveryTime+=dt;
    delta.setFromAxisAngle(up,heading);this.rotation.slerp(delta,1-Math.exp(-7*dt)).normalize();this.angularVelocity.multiplyScalar(Math.exp(-7*dt));this.updateAxes();
    this.supportLift=Math.max(0,.08-this.bounds().bottom);
    if(this.rotation.angleTo(delta)<.015||this.recoveryTime>1.1)this.reset(heading);
  }
  halfHeight(){return this.bounds().halfY;}
  bounds(){
    const q=this.rotation,rx=1-2*(q.y*q.y+q.z*q.z),ry=2*(q.x*q.y+q.z*q.w),rz=2*(q.x*q.z-q.y*q.w),ux=2*(q.x*q.y-q.z*q.w),uy=1-2*(q.x*q.x+q.z*q.z),uz=2*(q.y*q.z+q.x*q.w),fx=2*(q.x*q.z+q.y*q.w),fy=2*(q.y*q.z-q.x*q.w),fz=1-2*(q.x*q.x+q.y*q.y);
    const pivot=this.pivotHeight,lower=.08-pivot,upper=this.bodyTop-pivot,centre=(lower+upper)/2,half=(upper-lower)/2;
    const halfY=Math.abs(ry)*this.halfWidth+Math.abs(uy)*half+Math.abs(fy)*this.halfLength,y=pivot+uy*centre;
    return {halfX:Math.abs(rx)*this.halfWidth+Math.abs(ux)*half+Math.abs(fx)*this.halfLength,halfZ:Math.abs(rz)*this.halfWidth+Math.abs(uz)*half+Math.abs(fz)*this.halfLength,halfY,bottom:y-halfY,top:y+halfY,offsetX:ux*centre,offsetZ:uz*centre};
  }
}
