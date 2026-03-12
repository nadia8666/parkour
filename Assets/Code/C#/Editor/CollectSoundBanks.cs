using UnityEditor;
using UnityEngine;

[CustomAirshipEditor("SoundController")]
public class SoundControllerEditor : AirshipEditor
{
    public override void OnInspectorGUI()
    {
        EditorGUILayout.LabelField("Definition Data");
        PropertyFields("SoundBanks", "SoundTemplate");

        if (GUILayout.Button("Populate Banks"))
        {
            GenerateBanks(serializedObject.FindAirshipProperty("SoundBanks"));
            serializedObject.ApplyModifiedProperties();
        }
    }

    [MenuItem("Parkour/Generate Sound Bank List")]
    public static void GenerateBanks(AirshipSerializedProperty property)
    {
        string[] guids = AssetDatabase.FindAssets("t:ScriptableObject", new[] { "Assets/Resources/Sounds/Banks" });
        int count = guids.Length;

        property.array.ClearArray();
        for (int i = 0; i < count; i++)
        {
            string path = AssetDatabase.GUIDToAssetPath(guids[i]);
            AirshipScriptableObject so = AssetDatabase.LoadAssetAtPath<AirshipScriptableObject>(path);

            var arrayVal = property.array.PushElement();
            arrayVal.objectReferenceValue = so;
        }
    }
}