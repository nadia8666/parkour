using System;
using System.Collections.Generic;
using Godot;
using Parkour.Lib;

namespace Parkour.Actor;

public partial class ActorAnimation : AnimationTree
{
    public float GlobalFadeIn { get; set; } = 0.1f;
    public float GlobalFadeOut { get; set; } = 0.1f;

    private sealed record TrackDefinition(
        string Name,
        int Priority,
        bool Loop,
        float Speed,
        string Next = null,
        float? FadeIn = null,
        float? FadeOut = null,
        string Type = "none"
    );

    private sealed class Track(TrackDefinition definition)
    {
        public readonly TrackDefinition Definition = definition;
        public string BlendNode => $"Blend_{Definition.Name}";
        public string SpeedNode => $"Speed_{Definition.Name}";
        public string SeekNode => $"Seek_{Definition.Name}";
        public float Weight;
        public float TargetWeight;
        public float FadeStartWeight;
        public float FadeElapsed;
        public float FadeDuration;
        public float Speed = definition.Speed;
        public double PlaybackTime;
        public double Length;
        public bool IsPlaying;
    }

    private static readonly TrackDefinition[] trackDefs =
    [
        // airborne
        new("fall", 10, true, 1f, FadeIn: 0.12f, FadeOut: 0.12f, Type: "airborne"),
        new("jump_l", 30, false, 1f, FadeIn: 0.04f, Type: "airborne"),
        new("jump_r", 30, false, 1f, FadeIn: 0.04f, Type: "airborne"),
        new("edge_jump_l", 30, false, 1.2f, FadeIn: 0.125f, Type: "airborne"),
        new("edge_jump_r", 30, false, 1.2f, FadeIn: 0.125f, Type: "airborne"),
        new("coil", 31, false, 1f, FadeIn: 0.08f, Type: "airborne"),

        // slide
        new("powerslide_start", 40, false, 1f, "powerslide_loop", FadeIn: 0.08f),
        new("powerslide_loop", 41, true, 1f, FadeIn:0, FadeOut: 0.12f),
        
        // landing
        new("roll", 50, false, 1f, FadeIn: 0.04f, FadeOut: 0.12f),

        // wallrun
        new("wallrun_l", 50, false, 1f),
        new("wallrun_r", 50, false, 1f),

        // ledge
        new("ledge_grab", 60, false, 1f, FadeOut: 0.2f),
    ];

    private readonly Dictionary<string, Track> tracks = new(StringComparer.Ordinal);
    private AnimationPlayer animationPlayer;
    private bool nextJumpIsLeft = true;

    [Export] private Actor3D actor;

    public override void _Ready()
    {
        base._Ready();
        animationPlayer = actor.GetNode<AnimationPlayer>("PlayerModel/Animator");

        foreach (TrackDefinition definition in trackDefs)
        {
            Animation clip = animationPlayer.GetAnimation($"CharAnims/{definition.Name}");
            if (clip == null)
            {
                GD.PushError($"Missing animation clip: CharAnims/{definition.Name}");
                continue;
            }

            tracks.Add(definition.Name, new Track(definition) { Length = clip.Length });
        }

        BuildAnimationTree();
        Active = true;
    }

    private void BuildAnimationTree()
    {
        AnimationNodeBlendTree tree = new();

        tree.AddNode("Idle", new AnimationNodeAnimation { Animation = "CharAnims/idle" }, new Vector2(-600, -60));
        tree.AddNode("Run", new AnimationNodeAnimation { Animation = "CharAnims/run_forward" }, new Vector2(-600, 60));
        tree.AddNode("RunBlend", new AnimationNodeBlend2(), new Vector2(-400, 0));
        tree.ConnectNode("RunBlend", 0, "Idle");
        tree.ConnectNode("RunBlend", 1, "Run");
        tree.AddNode("RunSpeed", new AnimationNodeTimeScale(), new Vector2(-200, 0));
        tree.ConnectNode("RunSpeed", 0, "RunBlend");

        string previousNode = "RunSpeed";
        List<Track> orderedTracks = [.. tracks.Values];
        orderedTracks.Sort((left, right) => left.Definition.Priority.CompareTo(right.Definition.Priority));

        foreach (Track track in orderedTracks)
        {
            string animationNode = $"Animation_{track.Definition.Name}";
            tree.AddNode(animationNode, new AnimationNodeAnimation
            {
                Animation = $"CharAnims/{track.Definition.Name}"
            }, new Vector2(0, track.Definition.Priority * 4));

            tree.AddNode(track.SeekNode, new AnimationNodeTimeSeek(), new());
            tree.ConnectNode(track.SeekNode, 0, animationNode);

            tree.AddNode(track.SpeedNode, new AnimationNodeTimeScale(), new());
            tree.ConnectNode(track.SpeedNode, 0, track.SeekNode);

            tree.AddNode(track.BlendNode, new AnimationNodeBlend2(), new());
            tree.ConnectNode(track.BlendNode, 0, previousNode);
            tree.ConnectNode(track.BlendNode, 1, track.SpeedNode);
            previousNode = track.BlendNode;
        }

        tree.ConnectNode("output", 0, previousNode);
        TreeRoot = tree;
    }

    public void Play(string name, float fadeIn = -1, float weight = 1f, float speed = -1)
    {
        if (!tracks.TryGetValue(name, out Track track))
        {
            GD.PushWarning($"Unknown animation track: {name}");
            return;
        }

        track.IsPlaying = true;
        track.PlaybackTime = 0;
        track.Speed = speed < 0 ? track.Definition.Speed : speed;
        FadeTo(track, Mathf.Clamp(weight, 0, 1), fadeIn < 0 ? track.Definition.FadeIn ?? GlobalFadeIn : fadeIn);
        Set($"parameters/{track.SeekNode}/seek_request", 0f);
    }

    public void SafePlay(string name, float fadeIn = -1, float weight = 1f, float speed = -1)
    {
        if (tracks.TryGetValue(name, out Track track) && track.IsPlaying)
            return;

        Play(name, fadeIn, weight, speed);
    }

    public void Stop(string name, float fadeOut = -1)
    {
        if (!tracks.TryGetValue(name, out Track track))
            return;

        track.IsPlaying = false;
        FadeTo(track, 0, fadeOut < 0 ? track.Definition.FadeOut ?? GlobalFadeOut : fadeOut);
    }

    public void SafeStop(string name, float fadeOut = -1)
    {
        if (!tracks.TryGetValue(name, out Track track) || !track.IsPlaying)
            return;

        Stop(name, fadeOut);
    }

    public void SetWeight(string name, float weight, float fadeDuration = 0)
    {
        if (!tracks.TryGetValue(name, out Track track))
            return;

        FadeTo(track, Mathf.Clamp(weight, 0, 1), fadeDuration);
    }

    public void SetSpeed(string name, float speed)
    {
        if (tracks.TryGetValue(name, out Track track))
            track.Speed = speed;
    }

    public void PlayJump(bool isEdge)
    {
        string name = nextJumpIsLeft ? "jump_l" : "jump_r";
        nextJumpIsLeft = !nextJumpIsLeft;

        if (isEdge)
            name = $"edge_{name}";

        Play(name);
    }

    public void StopType(string type, float fadeOut = -1)
    {
        foreach (var def in trackDefs)
            if (def.Type == type)
                SafeStop(def.Name, fadeOut);
    }

    public void UpdateAnimations(float delta)
    {
        float movementForce = actor.Velocity.WithY(0).Length() / 2;
        float movementBlend = Mathf.Clamp(movementForce / 3f, 0, 1);
        Set("parameters/RunBlend/blend_amount", movementBlend);

        float runSpeed = Mathf.Lerp(1, actor.momentum / 6, Mathf.Min(movementBlend, 1));
        Set("parameters/RunSpeed/scale", actor.Grounded ? runSpeed : 1f);

        UpdateStateTrack("fall", actor.Airborne);
        UpdateTracks(delta);
    }

    private void UpdateStateTrack(string name, bool shouldPlay)
    {
        if (!tracks.TryGetValue(name, out Track track))
            return;

        if (shouldPlay)
            SafePlay(name);
        else
            SafeStop(name);
    }

    private void UpdateTracks(float delta)
    {
        foreach (Track track in tracks.Values)
        {
            if (track.IsPlaying && track.Length > 0)
            {
                track.PlaybackTime += delta * track.Speed;
                if (track.Definition.Loop && track.PlaybackTime >= track.Length)
                {
                    track.PlaybackTime %= track.Length;
                    Set($"parameters/{track.SeekNode}/seek_request", (float)track.PlaybackTime);
                }
                else if (!track.Definition.Loop && track.PlaybackTime >= track.Length)
                {
                    if (track.Definition.Next != null)
                        Play(track.Definition.Next);

                    Stop(track.Definition.Name);
                }
            }

            UpdateFade(track, delta);
            Set($"parameters/{track.BlendNode}/blend_amount", track.Weight);
            Set($"parameters/{track.SpeedNode}/scale", track.Speed);
        }
    }

    private static void FadeTo(Track track, float target, float duration)
    {
        track.FadeStartWeight = track.Weight;
        track.TargetWeight = target;
        track.FadeElapsed = 0;
        track.FadeDuration = Mathf.Max(0, duration);
        if (track.FadeDuration == 0)
            track.Weight = target;
    }

    private static void UpdateFade(Track track, float delta)
    {
        if (track.FadeDuration <= 0)
            return;

        track.FadeElapsed = Mathf.Min(track.FadeElapsed + delta, track.FadeDuration);
        float amount = track.FadeElapsed / track.FadeDuration;
        track.Weight = Mathf.Lerp(track.FadeStartWeight, track.TargetWeight, amount);
    }
}
