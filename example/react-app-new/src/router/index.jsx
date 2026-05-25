import { useEffect, useState } from 'react';
import { HashRouter, Route, Switch, Redirect } from 'react-router-dom';

import ModelIndex from '../views/home/homeIndex';
import Upload from '../views/ upload/uploadIndex';

function RouterIndex() {
	return (
		<HashRouter>
			<Switch>
				<Route path='/home' component={ModelIndex} />
				<Route path='/upload' exact component={Upload} />
				<Route path='/' exact component={ModelIndex} />
			</Switch>
		</HashRouter>
	);
}

export default RouterIndex;
