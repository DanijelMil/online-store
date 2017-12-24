import { h, Component } from 'preact';
import { Link } from 'preact-router/match';
import { connect } from 'unistore/preact';
import actions from '../../actions';
import { getBasketTotal } from '../../utils/cart';
import { formatCurrency } from '../../../functions/helpers';

import './style';

export class Header extends Component {
	state = {
		showBasket: false
	};

	componentDidMount() {
		this.props.loadProducts();
	}

	render({ basket }, { showBasket }) {
		const total = getBasketTotal(basket);

		return (
			<header class="header">
				<h1>
					<Link href="/">Online Store</Link>
				</h1>
				<nav>
					<Link href="/basket">
						{basket.length > 0
							? `Buy ${basket.length} products for ${formatCurrency(total)}`
							: ''}
					</Link>
				</nav>
			</header>
		);
	}
}

export default connect('basket,products', actions)(Header);
