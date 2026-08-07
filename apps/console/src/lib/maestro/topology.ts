import type { AxisId, RuntimeInvariantResult, USTAtom } from "./types";

type KeyDefinition = { name: string; leaves: readonly string[] };
type AxisDefinition = { id: AxisId; name: string; keys: readonly KeyDefinition[] };

export const TECHNICAL_UST: readonly AxisDefinition[] = [
  {
    id: "THY", name: "Theory", keys: [
      { name: "Tonal_System", leaves: ["Root_Note", "Primary_Mode", "Secondary_Centers", "Chromatic_Tension_Classes", "Modulation_Policy"] },
      { name: "Harmonic_Grammar", leaves: ["Function_Inventory", "Cadential_Shapes", "Pedal_Points", "Non_Diatonic_Entry_Modes", "Chord_Extensions"] },
      { name: "Rhythmic_Grid", leaves: ["Meter", "Tempo_BPM", "Feel_Mode", "Subdivision_Policy", "Syncopation_Profile"] },
      { name: "Form_and_Motifs", leaves: ["Phrase_Length_Options", "Motif_Cell_Length", "Motif_Development_Modes", "Section_Relation_Map", "Tension_Release_Curve"] },
    ],
  },
  {
    id: "VOC", name: "Voices", keys: [
      { name: "Lead_Identity", leaves: ["Timbre_Profile", "Register_Range", "Accent_Color", "Delivery_Mixture", "Emotion_Palette"] },
      { name: "Delivery_Techniques", leaves: ["Flow_Pattern_Type", "Melisma_Density", "Vibrato_Policy", "Articulation_Sharpness", "Intensity_By_Section"] },
      { name: "Harmony_and_Choir", leaves: ["Stack_Roles", "Voicing_Style", "Unison_vs_Intervals_Ratio", "Call_Response_Map", "Choir_Energy_Curve"] },
      { name: "Adlibs_and_FX_Voices", leaves: ["Adlib_Density_By_Section", "Adlib_Semantic_Mode", "Stereo_Placement_Policy", "Timing_Relation_to_Main", "Talkover_Slots"] },
    ],
  },
  {
    id: "STY", name: "Style", keys: [
      { name: "Genre_Stack", leaves: ["Primary_Genre", "Secondary_Genres", "Weighting", "Forbidden_Style_Regions", "Scene_Tagging"] },
      { name: "Era_and_Texture", leaves: ["Era_Reference", "Modernity_Tilt", "Texture_Descriptors", "Color_Palette", "Energy_Tier_Map"] },
      { name: "Emotional_Narrative", leaves: ["Start_State", "Mid_State", "End_State", "Primary_Tension_Theme", "Primary_Resolution_Theme"] },
      { name: "Audience_and_Use_Case", leaves: ["Playback_Context", "Explicitness_Level", "Replayability_Priority", "DJ_Friendliness", "Sync_Potential"] },
    ],
  },
  {
    id: "TIM", name: "Timbre", keys: [
      { name: "Instrument_Palette", leaves: ["Core_Instruments", "Role_By_Instrument", "Texture_Mode", "Analog_vs_Digital_Ratio", "Noise_Sources"] },
      { name: "Register_Separation", leaves: ["Sub_Register_Content", "Low_Mids_Content", "High_Mids_Content", "Air_Band_Content", "Clash_Avoidance_Policy"] },
      { name: "Signature_Sounds", leaves: ["Signature_Motif_Instrument", "Hook_Signature_FX", "Intro_Signature", "Outro_Signature", "Forbidden_Timbres"] },
      { name: "Sectional_Timbre_Overrides", leaves: ["Intro_Palette_Override", "Verse_Palette_Override", "Hook_Palette_Override", "Bridge_Palette_Override", "Breakdown_Palette_Override"] },
    ],
  },
  {
    id: "PER", name: "Performance", keys: [
      { name: "Groove_Profile", leaves: ["Kick_Behavior", "Snare_Clap_Behavior", "HiHat_Grid", "Bass_Relation_to_Kick", "Push_Pull_Profile"] },
      { name: "Dynamics", leaves: ["Sectional_Dynamic_Map", "Fill_Frequency", "Drum_Fill_Length_Options", "Breakdown_Strategy", "Climax_Location"] },
      { name: "Humanization", leaves: ["Timing_Variation_Range", "Velocity_Variation_Range", "Humanized_Elements", "Quantize_Strictness_By_Layer", "Swing_Source"] },
      { name: "Performance_Cues", leaves: ["Drop_Cues", "Build_Cues", "Stop_Time_Cues", "Crowd_Interaction_Cues", "DJ_Cue_Tags"] },
      { name: "Section_List", leaves: ["Sections", "Bar_Count_By_Section", "Function_By_Section", "Focus_By_Section", "Double_Time_or_Half_Time_By_Section"] },
      { name: "Transition_Logic", leaves: ["Into_Cues", "Out_Of_Cues", "Energy_Jumps", "FX_At_Transitions", "Silence_or_Pause_Slots"] },
      { name: "Axis_Overrides", leaves: ["Theory_Overrides", "Vocals_Overrides", "Timbre_Overrides", "Performance_Overrides", "Post_Overrides"] },
      { name: "Live_Arranger_Notes", leaves: ["Optional_Loops", "Optional_Cuts", "Extended_Outros", "DJ_Friendly_In_Out", "Alternate_Versions"] },
    ],
  },
  {
    id: "POST", name: "Post-Production", keys: [
      { name: "Mix_Priority", leaves: ["Priority_Order", "Vocal_Position", "Low_End_Policy", "Mid_Clarity_Rules", "Top_End_Treatment"] },
      { name: "Space_and_Ambience", leaves: ["Reverb_Types", "Delay_Types", "Dry_Wet_Policy_By_Layer", "Space_Identity", "Section_Space_Overrides"] },
      { name: "Loudness_and_Tone", leaves: ["Target_LUFS", "Reference_Profile", "Saturation_Level", "Stereo_Width_Policy", "Limiter_Behavior"] },
      { name: "Translation_Checks", leaves: ["Target_Systems", "Low_Volume_Check", "Mono_Compat_Priority", "Club_Impact_Priority", "Headphone_Immersion_Priority"] },
    ],
  },
  {
    id: "LYR", name: "Lyrics", keys: [
      { name: "Global_Lyric_Policy", leaves: ["Point_of_View", "Tense", "Core_Themes", "Profanity_Policy", "Imagery_Register"] },
      { name: "Section_Lyric_Grids", leaves: ["Lines_Per_Section", "Bars_Per_Line", "Rhyme_Scheme_By_Section", "Anchor_Lines", "Hook_Tag_Lines"] },
      { name: "Line_Level_Metadata", leaves: ["Syllable_Count_By_Line", "Stress_Pattern_By_Line", "Rhyme_Class_By_Line", "Motif_Tag_By_Line", "Emotional_Beat_By_Line"] },
      { name: "Word_Level_Metadata", leaves: ["Emphasis_Flags_By_Word", "Melisma_Flags_By_Word", "Pitch_Target_Hints_By_Word", "Timing_Offset_Hints_By_Word", "FX_Binding_By_Word"] },
      { name: "Lock_and_Validation", leaves: ["Lock_Flag", "Allowed_Operations", "Forbidden_Operations", "Validation_Rules", "Violation_Severity_Map"] },
    ],
  },
] as const;

export const RETIRED_ADDRESS_MIGRATIONS = {
  "MAP.K1": "PER.K5",
  "MAP.K2": "PER.K6",
  "MAP.K3": "PER.K7",
  "MAP.K4": "PER.K8",
} as const;

export function createNullTechnicalUst(): USTAtom[] {
  const atoms: USTAtom[] = [];
  for (const axis of TECHNICAL_UST) {
    axis.keys.forEach((key, keyIndex) => {
      key.leaves.forEach((subkeyName, leafIndex) => {
        const keyId = `${axis.id}.K${keyIndex + 1}`;
        const subkeyId = `${keyId}.S${leafIndex + 1}`;
        atoms.push({
          address: subkeyId,
          axis: axis.id,
          keyId,
          keyName: key.name,
          subkeyId,
          subkeyName,
          value: null,
          state: "NULL",
          resolution: null,
          ownerId: null,
          reviewerIds: [],
          evidenceRefs: [],
          dependencyAddresses: [],
          contradictionIds: [],
          revision: 0,
          lockedSha256: null,
        });
      });
    });
  }
  return atoms;
}

export function validateTechnicalUstTopology(): RuntimeInvariantResult[] {
  const atoms = createNullTechnicalUst();
  const addresses = atoms.map((atom) => atom.address);
  const keyCount = TECHNICAL_UST.reduce((sum, axis) => sum + axis.keys.length, 0);
  const uniqueAddresses = new Set(addresses);
  const retiredMapPresent = addresses.some((address) => address.startsWith("MAP."));
  const allNull = atoms.every((atom) => atom.state === "NULL" && atom.value === null);
  return [
    { id: "UST.AXES.7", pass: TECHNICAL_UST.length === 7, detail: `${TECHNICAL_UST.length} active audio axes` },
    { id: "UST.KEYS.33", pass: keyCount === 33, detail: `${keyCount} keys` },
    { id: "UST.LEAVES.165", pass: atoms.length === 165, detail: `${atoms.length} leaf addresses` },
    { id: "UST.ADDRESSES.UNIQUE", pass: uniqueAddresses.size === atoms.length, detail: `${uniqueAddresses.size} unique addresses` },
    { id: "UST.MAP.RETIRED", pass: !retiredMapPresent, detail: retiredMapPresent ? "retired MAP address found" : "MAP functions migrated into PER.K5-K8" },
    { id: "UST.NULL.INIT", pass: allNull, detail: allNull ? "all leaves initialize as explicit NULL" : "non-null initialization detected" },
  ];
}
