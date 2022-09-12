import { LitElement, html, css, TemplateResult } from 'lit';

import { customElement, property } from 'lit/decorators.js';

import { SharedStyles } from './shared-styles.js';

import { ButtonSharedStyles } from './button-shared-styles.js';

import {
	CANCEL_ICON
} from './my-icons.js';

import {
	makeDialogShouldCloseEvent
} from '../events.js';

@customElement('dialog-element')
export class DialogElement extends LitElement {

	@property({ type : Boolean })
	open: boolean;

	@property({ type : String })
	override title: string;

	@property({ type : Boolean })
	mobile: boolean;

	static override get styles() {
		return [
			css`
			:host {
				position:absolute;
				height:100%;
				width:100%;
				top:0;
				left:0;
				/* Note that card-preview has a z-index higher than this to
				show up above it */
				z-index:1000;
			}

			.background {
				position:absolute;
				height:100%;
				width:100%;
				top:0;
				left:0;
				background-color:#FFFFFFCC;
				display:flex;
				flex-direction:column;
				align-items: center;
				justify-content:center;
			}

			.content {
				background-color:white;
				padding:1em;
				box-sizing: border-box;
				box-shadow: var(--card-shadow);
				position:relative;
				display:flex;
				flex-direction:column;
				min-height: 40%;
				min-width: 40%;
				max-height:90%;
				max-width:70%;
			}

			.mobile .content {
				height:100%;
				width:100%;
				max-height:none;
				max-width:none;
			}

			h2 {
				font-weight: normal;
				font-size:1.5em;
				text-align:left;
				margin:0;
			}

			#close {
				position: absolute;
				top: 0.5em;
				right: 0.5em;
			}

			#inner {
				flex-grow:1;
				display:flex;
				flex-direction:column;
				overflow:scroll;
			}


			`,
			SharedStyles,
			ButtonSharedStyles
		];
	}

	override render() : TemplateResult {
		return html`
			<style>
				:host {
					/* TODO: this is a hack to get it to override the static styles block */
					display: ${this.open ? 'block' : 'none'} !important;
				}
			</style>
			<div class='background ${this.mobile ? 'mobile': ''}' @click=${this._handleBackgroundClicked}>
				<div class='content'>
					<button class='small' id='close' @click=${this.cancel}>${CANCEL_ICON}</button>
					<h2>${this.title || ''}</h2>
					<div id='inner'>
					${this.innerRender()}
					</div>
				</div>
			</div>
	`;
	}

	innerRender() : TemplateResult {
		//You can subclass this and return somethingelse for innerRender or use it directly with content inside.
		return html`<slot></slot>`;
	}

	override firstUpdated() {
		window.addEventListener('keydown', e => this._handleKeyDown(e));
	}

	_handleKeyDown(e : KeyboardEvent) : void {
		if (!this.open) return;
		if (e.key == 'Escape') {
			this.cancel();
		}
	}

	_handleBackgroundClicked(e : MouseEvent) : void {
		const background = this.shadowRoot.querySelector('.background');
		//If the click wasn't actualy directly on the background then ignore it.
		if (e.composedPath()[0] != background) return;
		this._shouldClose();
	}

	cancel() {
		this._shouldClose(true);
	}

	//Will be called with a single argument of true if cancelled
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	_shouldClose(_canelled? : boolean) {
		//Override point for sub classes
		this.dispatchEvent(makeDialogShouldCloseEvent());
	}

	_focusInputOnOpen() {
		//Override point for sub classes

		//Make sure if there's a text field it's focused.

		let input = this.shadowRoot.querySelector('input[type=text]');
		if (!input) input = this.shadowRoot.querySelector('input[type=search]');
		if (!input) input = this.shadowRoot.querySelector('textarea');
		if (!input) {
			const slot = this.shadowRoot.querySelector('slot');
			for (const ele of slot.assignedElements()) {
				if (ele.localName == 'textarea') {
					input = ele;
					break;
				}
			}
		}
		if (!input) return;
		if (!(input instanceof HTMLInputElement)) throw new Error('not input ele');
		input.focus();
		input.select();
	}

	override updated(changedProps : Map<string, DialogElement[keyof DialogElement]>) {
		if (changedProps.has('open') && this.open) {
			this._focusInputOnOpen();
		}
	}

}

declare global {
	interface HTMLElementTagNameMap {
		'dialog-element': DialogElement;
	}
}