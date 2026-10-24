import { Quaternion, Vector3, Euler } from './vendor/three.module.js';

export const DRIVE_TUNING=Object.freeze({speed:15,boostSpeed:24,reverseSpeed:7,acceleration:20,jumpSpeed:9.4,gravity:13.5,airThrust:23,airSpeed:31,ceiling:18});
export const CAR_PIVOT_HEIGHT=1.2;
const up=new Vector3(0,1,0),delta=new Quaternion(),axis=new Vector3(),euler=new Euler(0,0,0,'YXZ');

// The orientation is physical state: air steering applies angular velocity,
// and a dodge imparts an impulse. It never changes horizontal travel directly.
export class AerialDynamics {
  constructor(){this.rotation=new Quaternion();this.angularVelocity=new Vector3();this.forward=new Vector3();this.up=new Vector3();this.bodyTop=2.57;this.reset();}
  reset(heading=0){this.rotation.setFromAxisAngle(up,heading);this.angularVelocity.set(0,0,0);this.flying=false;this.recovering=false;this.airTime=0;this.dodgeAvailable=false;this.dodgeTime=0;this.recoveryTime=0;this.supportLift=0;this.updateAxes();}
  takeoff(heading,pitch=0,roll=0){this.reset(heading);this.rotation.setFromEuler(euler.set(pitch,heading,roll,'YXZ'));this.flying=true;this.dodgeAvailable=true;this.updateAxes();}
  updateAxes(){this.forward.set(0,0,1).applyQuaternion(this.rotation);this.up.set(0,1,0).applyQuaternion(this.rotation);}
  dodge(input={}){
    if(!this.flying||!this.dodgeAvailable||this.airTime>1.3)return null;
    this.dodgeAvailable=false;
    const forward=Number(Boolean(input.forward))-Number(Boolean(input.reverse)),side=Number(Boolean(input.left))-Number(Boolean(input.right));
    if(forward||side){const length=Math.hypot(forward,side);this.angularVelocity.set(forward/length*12,0,side/length*12);this.dodgeTime=.48;return {forward:forward/length,side:side/length};}
    return {forward:0,side:0};
  }
  stepAir(dt,input={}){
    this.airTime+=dt;this.dodgeTime=Math.max(0,this.dodgeTime-dt);
    if(!this.dodgeTime){
      const response=1-Math.exp(-5.5*dt);
      const targets=[(Number(!!input.forward)-Number(!!input.reverse))*3.8,(Number(!!input.left)-Number(!!input.right))*2.8,(Number(!!input.rollLeft)-Number(!!input.rollRight))*4.9];
      for(const [i,key] of ['x','y','z'].entries())this.angularVelocity[key]+=(targets[i]-this.angularVelocity[key])*response;
    }
    const speed=this.angularVelocity.length();
    if(speed>.00001){axis.copy(this.angularVelocity).divideScalar(speed);delta.setFromAxisAngle(axis,speed*dt);this.rotation.multiply(delta).normalize();}
    this.updateAxes();
  }
  land(heading){
    this.flying=false;this.dodgeAvailable=false;this.dodgeTime=0;this.recoveryTime=0;
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
    const lower=.08-CAR_PIVOT_HEIGHT,upper=this.bodyTop-CAR_PIVOT_HEIGHT,centre=(lower+upper)/2,half=(upper-lower)/2;
    const halfY=Math.abs(ry)*.94+Math.abs(uy)*half+Math.abs(fy)*1.45,y=CAR_PIVOT_HEIGHT+uy*centre;
    return {halfX:Math.abs(rx)*.94+Math.abs(ux)*half+Math.abs(fx)*1.45,halfZ:Math.abs(rz)*.94+Math.abs(uz)*half+Math.abs(fz)*1.45,halfY,bottom:y-halfY,top:y+halfY,offsetX:ux*centre,offsetZ:uz*centre};
  }
}
