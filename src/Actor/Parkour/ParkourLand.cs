using System;
using Godot;
using Parkour.Lib;

namespace Parkour.Actor.Parkour;

public partial class ActorParkour
{
    public const float MinLandingHeight = 8 * Actor3D.Unit;
    public const float MinDamageHeight = 20 * Actor3D.Unit;
    public const float FatalDistance = 65 * Actor3D.Unit;
    public const float MinDamage = 20;
    public const float LandCooldown = 0.5F;

    public const float RollWindow = 175;
    public const float PreciseWindow = 90;
    public const float PerfectWindow = 50;

    public const float MultUnprepared = 0.58f;
    public const float MultBad = 0.75f;
    public const float MultNormal = 0.80f;
    public const float MultImperfect = 0.95f;

    public double LastPrepareLanding = 0;
    public double LastPrepareHeld = 0;

    public void PrepareLanding()
    {
        LastPrepareLanding = Actor3D.Clock();
    }

    public float GetFatalDistance(float ms)
    {

        if (ms >= Mathf.Inf)
            return FatalDistance * MultUnprepared;
        else if (ms > RollWindow)
            return FatalDistance * MultBad;
        else if (ms > PreciseWindow)
            return FatalDistance * MultNormal;
        else if (ms > PerfectWindow)
            return FatalDistance * MultImperfect;
        return FatalDistance;
    }

    public void Land()
    {
        actor.animation.StopType("airborne");

        Vector3 airVelocity = actor.airVelocity;
        if (airVelocity.Y < 0)
        {
            float ms = (float)(LastPrepareLanding > 0 ? (Actor3D.Clock() - LastPrepareLanding) * 1000 : Mathf.Inf);
            float angleAlpha = actor.ground.Normal.Dot(Vector3.Up);
            float fallSpeed = angleAlpha * Mathf.Abs(airVelocity.Y); // pa uses magnitude, for Some reason.
            float metersFallen = (float)(0.5 * actor.physics.gravity * Mathf.Pow(fallSpeed / actor.physics.gravity, 2));
            float fatalDistance = GetFatalDistance(ms);
            float damageMult = ms <= PreciseWindow ? 0 : Mathf.Clamp((ms - PreciseWindow) / (500 - PreciseWindow), 0.35f, 1);

            float damageAlpha = Easing.EaseInCirc((metersFallen - MinDamageHeight) / (fatalDistance - MinDamageHeight));
            float damage = MinDamage + damageAlpha * (Actor3D.MaxHealth - MinDamage);


            string landType = "none";
            if (metersFallen > MinLandingHeight)
            {
                bool isMoving = actor.input.stickL.Length() > .1;
                if (ms > 0)
                {
                    if (actor.input.stickL.Length() >= .45 && ms >= RollWindow)
                        landType = "straight";
                    else if (isMoving && ms <= PreciseWindow && metersFallen >= MinDamageHeight)
                        landType = "roll";
                    else landType = "stumble";
                }
                else
                    landType = "hard";
            }
            else damage = 0;

            damage = damageMult > 0 ? damage * damageMult : 0;

            if (damage > 0)
                actor.ChangeHealth(-damage);

            // later on replace this with actual straight vs roll vs stumble
            if (landType == "hard")
                actor.momentum -= 100; // mommenutm rip
            else
            {
                if (landType != "roll" && landType != "none")
                    actor.momentum -= 3;

                if (coiling && actor.downmove.isDown)
                    TryPowerslide();
                else if (landType == "roll")
                {
                    actor.sound.roll.Play();
                    actor.animation.Play("roll");
                }
            }
        }
    }
}