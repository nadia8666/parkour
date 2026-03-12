using System;
using System.Collections.Generic;
using System.Linq;
using UnityEditor;
using UnityEngine;

public class VoxelStructureSerializer : EditorWindow
{
    private Vector3Int pos1;
    private Vector3Int pos2;
    private bool hasPos1;
    private bool hasPos2;
    private int selectionMode;

    [Serializable]
    public struct SerializableBlockData
    {
        public string[] blockIDs;
        public Vector3[] blockPositions;
    }

    [MenuItem("Parkour/Voxel Structure Serializer")]
    public static void ShowWindow()
    {
        GetWindow<VoxelStructureSerializer>("Voxel Serializer");
    }

    private void OnEnable()
    {
        SceneView.duringSceneGui += OnSceneGUI;
    }

    private void OnDisable()
    {
        SceneView.duringSceneGui -= OnSceneGUI;
    }

    private void OnGUI()
    {
        GUILayout.Label($"Pos 1: {(hasPos1 ? pos1.ToString() : "Not Set")}", EditorStyles.boldLabel);
        GUILayout.Label($"Pos 2: {(hasPos2 ? pos2.ToString() : "Not Set")}", EditorStyles.boldLabel);

        GUI.backgroundColor = selectionMode == 1 ? Color.green : Color.white;
        if (GUILayout.Button("Set Pos 1")) selectionMode = 1;

        GUI.backgroundColor = selectionMode == 2 ? Color.green : Color.white;
        if (GUILayout.Button("Set Pos 2")) selectionMode = 2;

        GUI.backgroundColor = Color.white;
        if (GUILayout.Button("Serialize Structure")) ExecuteSerializer();
    }

    private void OnSceneGUI(SceneView sceneView)
    {
        Event e = Event.current;

        if (selectionMode != 0 && e.type == EventType.MouseDown && e.button == 0)
        {
            Ray ray = HandleUtility.GUIPointToWorldRay(e.mousePosition);
            if (Physics.Raycast(ray, out RaycastHit hit))
            {
                Vector3 adjustedPoint = hit.point - (hit.normal * 0.5f);
                Vector3Int flooredPos = Vector3Int.FloorToInt(adjustedPoint);

                if (selectionMode == 1)
                {
                    pos1 = flooredPos;
                    hasPos1 = true;
                }
                else if (selectionMode == 2)
                {
                    pos2 = flooredPos;
                    hasPos2 = true;
                }

                selectionMode = 0;
                Repaint();
                e.Use();
            }
        }

        if (hasPos1)
        {
            Handles.color = Color.blue;
            Handles.DrawWireCube(pos1 + new Vector3(0.5f, 0.5f, 0.5f), Vector3.one);
        }

        if (hasPos2)
        {
            Handles.color = Color.red;
            Handles.DrawWireCube(pos2 + new Vector3(0.5f, 0.5f, 0.5f), Vector3.one);
        }

        if (hasPos1 && hasPos2)
        {
            Vector3Int min = Vector3Int.Min(pos1, pos2);
            Vector3Int max = Vector3Int.Max(pos1, pos2);
            Vector3 size = (Vector3)(max - min) + Vector3.one;
            Vector3 center = (Vector3)min + size / 2f;

            Handles.color = Color.yellow;
            Handles.DrawWireCube(center, size);
        }
    }

    private void ExecuteSerializer()
    {
        if (!hasPos1 || !hasPos2)
        {
            return;
        }

        var start = Vector3Int.Min(pos1, pos2);
        var end = Vector3Int.Max(pos1, pos2);
        var blocksToRead = new List<Vector3>();
        for (int x = start.x; x <= end.x; x++)
        {
            for (int y = start.y; y <= end.y; y++)
            {
                for (int z = start.z; z <= end.z; z++)
                {
                    blocksToRead.Add(new Vector3(x, y, z));
                }
            }
        }

        var instance = VoxelWorld.GetFirstInstance();
        var blocks = instance.BulkReadVoxels(blocksToRead.ToArray());
        var blockNames = new List<string>();
        foreach (var id in blocks)
        {
            var name = instance.voxelBlocks.GetBlockDefinitionFromBlockId(id);
            blockNames.Add(name.definition.blockName);
        }
        
        var data = new SerializableBlockData
        {
            blockIDs = blockNames.ToArray(),
            blockPositions = blocksToRead.ToArray()
        };

        GUIUtility.systemCopyBuffer = JsonUtility.ToJson(data);
        Debug.Log("Copied structure to clipboard!");
    }
}