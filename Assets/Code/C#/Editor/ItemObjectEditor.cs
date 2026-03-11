using UnityEditor;
using UnityEngine;

[CustomAirshipEditor("ItemObject")]
public class ItemObjectEditor : AirshipEditor
{
    public override void OnInspectorGUI()
    {
        EditorGUILayout.LabelField("Definition Data");
        PropertyFields("Name", "DisplayName", "Rarity");

        AirshipEditorGUI.BeginGroup(new GUIContent("Model Config"));

        PropertyField("ModelType");
        AirshipEditorGUI.HorizontalLine();

        var ModelType = serializedObject.FindAirshipProperty("ModelType");
        switch (ModelType.enumValue.name)
        {
            case "ImageGenerated":
                OnItemGenerated();
                break;
            case "BlockModel":
                OnBlockModel();
                break;
        }

        AirshipEditorGUI.EndGroup();
    }

    public void OnItemGenerated()
    {
        PropertyFields("ItemTexture", "ItemThickness");
    }

    public void OnBlockModel()
    {
        PropertyFields("BlockDef");
    }
}