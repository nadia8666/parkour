Shader "Unlit/BlockBreakOverlayShader"
{
    Properties
    {
        _DamageTexArray ("Damage Texture Array", 2DArray) = "" {}
    }
    SubShader
    {
        Tags 
        { 
            "RenderPipeline" = "UniversalPipeline"
            "RenderType" = "Transparent" 
            "Queue" = "Transparent" 
        }

        Pass
        {
            Name "DamagePass"
            Offset -1, -1
            
            ZWrite Off
            Blend SrcAlpha OneMinusSrcAlpha
            Cull Back

            HLSLPROGRAM
            #pragma vertex vert
            #pragma fragment frag

            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"

            struct Attributes
            {
                float4 positionOS : POSITION;
                float3 normalOS   : NORMAL;
                float2 damageUV   : TEXCOORD1;
            };

            struct Varyings
            {
                float4 positionCS : SV_POSITION;
                float3 positionWS : TEXCOORD0;
                float3 normalWS   : TEXCOORD1;
                float3 positionOS : TEXCOORD3;
                float3 normalOS   : TEXCOORD4;
                float2 damageUV   : TEXCOORD5; 
            };

            TEXTURE2D_ARRAY(_DamageTexArray);
            SAMPLER(sampler_DamageTexArray);
            TEXTURE3D(_Lightmap);
            SAMPLER(sampler_Lightmap);

            float4 _GridCenter;
            float4 _GridSize;
            float _VerticalOffset;

            CBUFFER_START(UnityPerMaterial)
                float4 _DamageTexArray_ST;
            CBUFFER_END

            Varyings vert(Attributes input)
            {
                Varyings output;
                output.positionWS = TransformObjectToWorld(input.positionOS.xyz);
                output.positionCS = TransformObjectToHClip(input.positionOS.xyz);
                output.normalWS = TransformObjectToWorldNormal(input.normalOS);
                output.positionOS = input.positionOS.xyz;
                output.normalOS = input.normalOS;
                output.damageUV = input.damageUV;
                return output;
            }

            float4 frag(Varyings input) : SV_Target
            {
                float3 triplanarPos = input.positionOS + _VerticalOffset;
                float3 localNormal = normalize(input.normalOS);
                float3 blend = abs(localNormal);
                blend /= (blend.x + blend.y + blend.z);

                float2 uvX = triplanarPos.zy * _DamageTexArray_ST.xy + _DamageTexArray_ST.zw;
                float2 uvY = triplanarPos.xz * _DamageTexArray_ST.xy + _DamageTexArray_ST.zw;
                float2 uvZ = triplanarPos.xy * _DamageTexArray_ST.xy + _DamageTexArray_ST.zw;

                float damageIndex = input.damageUV.x;
                
                float4 damageTex = SAMPLE_TEXTURE2D_ARRAY(_DamageTexArray, sampler_DamageTexArray, uvX, damageIndex) * blend.x +
                                   SAMPLE_TEXTURE2D_ARRAY(_DamageTexArray, sampler_DamageTexArray, uvY, damageIndex) * blend.y +
                                   SAMPLE_TEXTURE2D_ARRAY(_DamageTexArray, sampler_DamageTexArray, uvZ, damageIndex) * blend.z;

                float3 normalWS = normalize(input.normalWS);
                float3 adjustedPos = input.positionWS + (normalWS * 0.5);
                float3 uvw = (adjustedPos - _GridCenter.xyz + (_GridSize.xyz/2)) / _GridSize.xyz;
                float light = SAMPLE_TEXTURE3D(_Lightmap, sampler_Lightmap, float3(uvw.x, floor(adjustedPos.y)/_GridSize.y, uvw.z)).r;

                return float4(damageTex.rgb * light, damageTex.a);
            }
            ENDHLSL
        }
    }
}