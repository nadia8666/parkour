using Godot;
using Microsoft.Extensions.DependencyInjection;
using Parkour.Core;
using System;
using System.Linq;
using System.Reflection;

namespace Parkour;

public partial class ServiceLoader : Node
{
    public static ServiceLoader Instance { get; private set; }
    public static IServiceProvider Services { get; private set; }
    public override void _EnterTree()
    {
        if (Instance == null)
            Instance = this;
        else
        { QueueFree(); return; }

        ServiceCollection services = new();
        
        // autoload singletons
        foreach (var type in Assembly.GetExecutingAssembly().GetTypes()
           .Where(t => typeof(ISingleton).IsAssignableFrom(t)
                    && !t.IsInterface
                    && !t.IsAbstract))
            services.AddSingleton(type);

        Services = services.BuildServiceProvider();

        Services.GetRequiredService<SceneContainer>().Scene = (Node3D)GetTree().CurrentScene;
        Services.GetRequiredService<Framework>().Initialize();
    }
}
