import { TweenEasingFunction } from "@Easy/Core/Shared/Tween/EasingFunctions";
import { Tween } from "@Easy/Core/Shared/Tween/Tween";
import Config from "Code/Client/Config";
import Core from "Code/Core/Core";
import type ClientComponent from "../ClientComponent";
import { Actions } from "../Input";
import type { CastResults } from "./Base";

export class MovesetGeneric {
	public StartWallboost(Controller: ClientComponent) {
		if (!Controller.Moveset.Base.DashActive()) return;
		if (Controller.Rigidbody.linearVelocity.y < Config.WallclimbThreshold()) return;

		Controller.ResetLastFallSpeed();

		const Velocity = Controller.GetVelocity();
		Controller.SetVelocity(Velocity.WithY(math.max(Velocity.y, 0) + 22.5));

		Controller.AnimationController.Current = "VM_LongJump"; // TEMP
		Core().Client.Sound.Play("footstepfast");

		Controller.Gear.Ammo.Wallclimb--;
	}

	public StartWallclutch(Controller: ClientComponent, ForwardCast: CastResults) {
		if (!Controller.Moveset.Base.DashActive()) return;
		if (Controller.Rigidbody.linearVelocity.y < Config.WallclimbThreshold() * 2.25) return;

		const TargetLook = Quaternion.LookRotation(ForwardCast.Normal.mul(-1), Vector3.up);
		Controller.Rigidbody.rotation = TargetLook;
		Controller.State = "Wallclutch";
		Controller.SetVelocity(new Vector3(0, 3, 0));
		Controller.AnimationController.Current = "VM_Wallclutch";

		Tween.Number(
			TweenEasingFunction.InSine,
			0.1,
			(Speed) => {
				Controller.SetVelocity(new Vector3(0, Speed, 0));
			},
			3,
			-6,
		);

		const Start = os.clock();
		task.wait(0.5);
		while (os.clock() - Start < 1) {
			if (!Actions.WallAction.Active) break;
			else task.wait();
		}

		Controller.Moveset.Base.ResetDash();
		Controller.Moveset.Base.StartDash(Controller);
		Controller.SetVelocity(Vector3.zero);
		Controller.State = "Airborne";

		if (!Actions.WallAction.Active) {
			Controller.Gear.Ammo.Wallclimb--;
		}
	}
}
