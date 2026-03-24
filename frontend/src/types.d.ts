declare module 'react-plotly.js' {
  import { Component } from 'react';
  interface PlotParams {
    data: any[];
    layout?: any;
    config?: any;
    style?: any;
    className?: string;
    onInitialized?: (figure: any) => void;
    onUpdate?: (figure: any) => void;
    onRelayout?: (event: any) => void;
    onClick?: (event: any) => void;
  }
  export default class Plot extends Component<PlotParams> {}
}
