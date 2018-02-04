// tslint:disable
import { ToolNames } from './labeling-screen/segment-image';
import * as wkt from 'terraformer-wkt-parser';

export interface Annotation {
  id: string;
  color: string;
  bounds: {lat: number, lng:number}[];
  editing: boolean;
  toolName: ToolNames;
  toolId: string;
}

export type Tool = {
  id: string;
  name: string;
  color: string;
  tool: ToolNames;
};

export interface AppState {
  imageInfo: {url: string, height: number, width: number} | undefined;
  currentToolId: string | undefined;
  annotations: Annotation[];
  hiddenTools: string[];
  deletedAnnotations: Annotation[];
  loading: boolean;
  tools: Tool[];
  errorLoadingImage?: string;
}

export function guid() {
  function s4() {
    return Math.floor((1 + Math.random()) * 0x10000)
      .toString(16)
      .substring(1);
  }
  return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
    s4() + '-' + s4() + s4() + s4();
}

export const toggleVisiblityOfTool = (state: AppState, toolId: string) => {
  const removeItem = (arr: string[], index: number) => [ ...arr.slice(0, index), ...arr.slice(index + 1) ];
  const currentHiddenTools = state.hiddenTools || [];
  const foundIndex = currentHiddenTools.indexOf(toolId);
  const hiddenTools = foundIndex === -1 ?
    [...currentHiddenTools, toolId] :
    removeItem(currentHiddenTools, foundIndex);

  return {...state, hiddenTools};
};


export const onNewAnnotation = (state: AppState, bounds: {lat: number, lng: number}[]) => {
  const currentTool = state.tools.find(({id}) => id === state.currentToolId);
  if (currentTool === undefined) {
    throw new Error('should not be able to add an annotation without a tool');
  }
  return {
    ...state,
    currentToolId: undefined,
    annotations: [
      ...state.annotations,
      {
        id: guid(),
        bounds,
        color: currentTool.color,
        editing: false,
        toolName: currentTool.tool,
        toolId: currentTool.id
      }
    ]
  };
};

export const deleteSelectedAnnotation = (state: AppState) => {
  const deleteAnnotationIndex = state.annotations.findIndex(({editing}) => editing === true);
  if (deleteAnnotationIndex !== undefined) {
    return {
      ...state,
      annotations: [
        ...state.annotations.slice(0, deleteAnnotationIndex),
        ...state.annotations.slice(deleteAnnotationIndex + 1),
      ],
      deletedAnnotations: [
        {...state.annotations[deleteAnnotationIndex], editing: false},
        ...state.deletedAnnotations
      ]
    };
  } else {
    return state;
  }
}

export const generateLabel = (state: AppState) => {

  const getPoints = ({bounds}: Annotation) => {
    const toPoint = ({lat, lng}: {lat: number, lng: number}) => [lng, lat];
    return [
      ...bounds.map(toPoint),
      toPoint(bounds[0])
    ];
  };

  const turnAnnotationsIntoWktString = (annotations: Annotation[]) => {
    return wkt.convert({
      "type": "MultiPolygon",
      "coordinates": annotations.map(getPoints).map((polygon) => [polygon])
    });
  };

  const annotationsByTool = state.annotations.reduce((annotationsByTool, annotation) => {
    if (!annotationsByTool[annotation.toolId]) {
      annotationsByTool[annotation.toolId] = []
    }

    return {
      ...annotationsByTool,
      [annotation.toolId]: [
        ...annotationsByTool[annotation.toolId],
        annotation
      ]
    };
  }, {})

  const label = Object.keys(annotationsByTool).reduce((label, toolId) => {
    const tool = state.tools.find(({id}) => id === toolId);
    if (!tool) {
      throw new Error('tool not foudn' + toolId);
    }
    return {
      ...label,
      [tool.name]: turnAnnotationsIntoWktString(annotationsByTool[toolId])
    }

  }, {})

  return JSON.stringify(label);
}
