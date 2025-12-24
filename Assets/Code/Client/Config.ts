const Config = {
	Gravity: new Vector3(0, -1, 0),

	JumpRequiredSpeed: 3, // jump height under this speed is scaled from 0-spd to 0-1
	JumpCoyoteTime: 0.25,

	WallClimbMinSpeed: 5, // upwards speed in wallclimb is max(spd, min)
	WallClimbThreshold: -10, // maximum velocity before you cant wallclimb

	WallrunCoyoteTime: 0.25, // time before you are dropped off of a wallrun without a wall next to you
	WallrunMinSpeed: 7, // forward wallrun speed is max(spd, min)
	WallrunGravity: 0.85, // multiplier for global gravity while wallrunning
	WallrunThreshold: -75, // maximum velocity before you cant wallrun
	WallrunSpeedBoost: 1.15, // multiplier for converted wallrun velocity (wr speed = in speed * boost)
};

export default Config;
