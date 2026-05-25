import React from 'react';
import { Page, PageSection } from '@patternfly/react-core';
import '@patternfly/react-core/dist/styles/base.css';
import './App.less';
import RouterIndex from './router/index.jsx';


import { ConfigProvider, Button } from 'antd';
import RScaleScreen from 'r-scale-screen';

import dayjs from 'dayjs';
import locale from 'antd/locale/zh_CN';
import 'dayjs/locale/zh-cn';
dayjs.locale('zh-cn');

export default class App extends React.Component {
	constructor(props) {
		super(props);
	}

	render() {
		return (
			// <Page className="full-height">
			//   <PageSection
			//     className="full-height"
			//     style={{ padding: '0px', width: '100%' }}
			//   >
			//     <Viewer url="http://localhost:8080/" viewerId="viewer1" />
			//   </PageSection>

			//   <PageSection
			//     className="full-height"
			//     style={{ padding: '0px', width: '50%' }}
			//   >
			//     <Viewer url="http://localhost:8081/" viewerId="viewer2" />
			//   </PageSection>
			// </Page>

			<ConfigProvider locale={locale}>
				<RScaleScreen height={1080} width={1920}>
          {/* <Viewer url='http://localhost:8080/' viewerId='viewer1' /> */}
          
				<RouterIndex />

				</RScaleScreen>
			</ConfigProvider>
		);
	}
}
