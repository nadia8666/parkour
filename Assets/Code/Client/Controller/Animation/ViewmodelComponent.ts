import { Signal } from "@Easy/Core/Shared/Util/Signal";
import Core from "Code/Core/Core";
import type AnimationController from "./AnimationController";
import type { InferredAnimation, SetAnimation } from "./AnimationController";

export default class ViewmodelComponent extends AirshipBehaviour {
	public AnimationController: AnimationController;
	public Controller: Animator;
	public EventListener: AnimationEventListener;
	public HeadTransform: Transform;
	public GrappleTransform: Transform;

	public EventTriggered = new Signal<string>();

	@Client()
	override Start() {
		this.AnimationController = Core().Client.Animation;
		this.AnimationController.Component = this;

		this.EventListener.OnAnimEvent((Key) => {
			if (Key === "EndAnimation") {
				const Animation = this.AnimationController.AnimList[this.AnimationController.Current] as SetAnimation;

				if (Animation.EndAnimation) {
					this.AnimationController.Current = Animation.EndAnimation;
				}
			} else {
				this.EventTriggered.Fire(Key);
			}
		});
	}

	private UpdateState(Animation: InferredAnimation, Playing: boolean, TransitionTime?: number) {
		if (Playing) {
			for (let i of $range(0, this.Controller.layerCount - 1)) {
				this.AnimationController.WeightLayers[i as 0].Target = 0;
			}

			for (const [Key, Value] of pairs(Animation)) {
				if (typeOf(Key) !== "number") {
					continue;
				}

				this.Controller.CrossFadeInFixedTime(typeIs(Value.Name, "string") ? Value.Name : Value.Name(), TransitionTime ?? 0.1, Key);
				this.AnimationController.WeightLayers[Key as 0].Target = 1;
			}
		}
	}

	private GetCurrentTrack(Animation: InferredAnimation) {
		let [Track, Layer] = [Animation[0].Name, 0];

		for (const [Key, Value] of pairs(Animation)) {
			if (typeOf(Key) !== "number") {
				continue;
			}

			if (Value.Position !== undefined) {
				let Triggered = false;

				const Next = Animation[Key + 1];
				if (Next?.Position) {
					Triggered = this.AnimationController.ClientSpeed.x >= Value.Position && this.AnimationController.ClientSpeed.x < Next.Position;
				} else {
					Triggered = this.AnimationController.ClientSpeed.x >= Value.Position;
				}

				if (Triggered) {
					Track = Value.Name;
					Layer = Key;
					break;
				}
			}
		}

		return $tuple(Track, Layer);
	}

	private UpdateSpeed(Value: InferredAnimation[0]) {
		let Speed: number;

		if (Value.Speed) {
			Speed = Value.Speed.Base + Value.Speed.Increment * this.AnimationController.Speed;
			if (Value.Speed.Absolute) {
				Speed = math.abs(Speed);
			}
		} else {
			Speed = this.AnimationController.Speed;
		}

		this.Controller.SetFloat("AnimSpeed", Speed);
	}

	private CalculateWeightAndSpeed(Animation: InferredAnimation, Initial: boolean = false) {
		for (const [Key, Value] of pairs(Animation)) {
			if (typeOf(Key) !== "number") {
				continue;
			}

			if (Value.Position !== undefined) {
				this.AnimationController.WeightLayers[Key as 0].Target = this.GetCurrentTrack(Animation)[0] === Value.Name ? 1 : 0.01;

				if (Initial) this.AnimationController.WeightLayers[Key as 0].Current = this.AnimationController.WeightLayers[Key as 0].Target;
			}

			this.UpdateSpeed(Value);
		}
	}

	private UpdateCurrent(Animation: InferredAnimation, Delta: number) {
		this.CalculateWeightAndSpeed(Animation);

		for (let i of $range(0, this.Controller.layerCount - 1)) {
			const Layer = this.AnimationController.WeightLayers[i as 0];
			Layer.Current = math.lerpClamped(Layer.Current, Layer.Target, 8 * Delta);

			this.Controller.SetLayerWeight(i, Layer.Current);
		}
	}

	public GetTransitions(Previous: SetAnimation, Animation: SetAnimation) {
		let [LastFrom, LastTo]: [number?, number?] = [undefined, undefined];
		let [NextFrom]: [number?, number?] = [undefined, undefined];

		if (Previous.Transitions) {
			if (Previous.Transitions.From) {
				LastFrom = Previous.Transitions.From.All;
			}

			if (Previous.Transitions.To) {
				LastTo = Previous.Transitions.To.All ?? Previous.Transitions.To[this.AnimationController.Current];
			}
		}

		if (Animation.Transitions) {
			if (Animation.Transitions.From) {
				NextFrom = Animation.Transitions.From.All ?? Animation.Transitions.From[this.AnimationController.Last];
			}
		}

		let TargetTime = NextFrom ?? LastTo ?? LastFrom;

		return TargetTime;
	}

	public Animate(DeltaTime: number) {
		const Previous = this.AnimationController.AnimList[this.AnimationController.Last] as SetAnimation;
		const Next = this.AnimationController.AnimList[this.AnimationController.Current] as SetAnimation;

		if (Previous !== Next) {
			this.AnimationController.Speed = 1;

			const TargetTime = this.GetTransitions(Previous, Next);

			this.UpdateState(Next, true, TargetTime);
			this.CalculateWeightAndSpeed(Next, true);

			this.AnimationController.Last = this.AnimationController.Current;
		}

		this.UpdateCurrent(Next, DeltaTime);
	}

	public GetRate() {
		const [_, Layer] = this.GetCurrentTrack(this.AnimationController.AnimList[this.AnimationController.Current]);
		const Clip = this.Controller.GetCurrentAnimatorStateInfo(Layer);

		return (Clip.speed * Clip.speedMultiplier) / Clip.length;
	}
}
